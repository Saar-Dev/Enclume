import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { runPanneTest, applyPanneSystematic, adjustIntegrity, computeAcquisitionIntegrity, rollOccasionIntegrity } from './integrityService.js'
import { QUALITY_TABLE } from '../../../shared/integrityRules.js'

// Lancement manuel : node --env-file=../.env --test server/src/services/integrityService.test.mjs
const skip = !process.env.DATABASE_URL

// integrityService = autorité d'écriture de l'ITG (PLAN_USURE&INTEGRITE.md §4). Verrou pessimiste
// `.forUpdate()` + relecture à frais. Le test de panne fait un vrai jet (resolvePolarisTest) — on
// le rend déterministe via l'ITG (25 → toujours réussite) ou on vérifie les invariants sur un lot
// de tirages.

async function createFixture({ current = 10, max = 15, hasIntegrity = true } = {}) {
  const [gm] = await db('users')
    .insert({ email: `itg-svc-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'itg-svc-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test integrityService', invite_code: `ITGSVC-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [owner] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Proprietaire', type: 'pj' })
    .returning('*')
  await db('char_sheet').insert({ character_id: owner.id, sols: 0 })

  const ref = hasIntegrity
    ? await db('ref_equipment').where({ has_integrity: true }).whereNull('location').first()
    : await db('ref_equipment').where({ has_integrity: false }).first()

  const insert = { character_id: owner.id, equipment_id: ref.id, container: 'Coffre', quantity: 1 }
  if (hasIntegrity) { insert.integrity_current = current; insert.integrity_max = max }
  const [item] = await db('char_inventory').insert(insert).returning('*')

  return { gm, campaign, owner, ref, item }
}

const cleanup = async ({ campaign, gm }) => {
  await db('campaigns').where({ id: campaign.id }).del()
  await db('users').where({ id: gm.id }).del()
}
const readItem = (id) => db('char_inventory').where({ id }).first()

// ── adjustIntegrity ─────────────────────────────────────────────────────────
test('adjustIntegrity — pose courante + max, puis la panne, puis « Opérationnel »', { skip }, async () => {
  const fx = await createFixture({ current: 10, max: 15 })
  try {
    const r1 = await adjustIntegrity(fx.item.id, { current: 12, max: 20 })
    assert.deepEqual(r1.after, { current: 12, max: 20, malfunction_severity: null })

    await adjustIntegrity(fx.item.id, { malfunction: 'simple' })
    assert.equal((await readItem(fx.item.id)).malfunction_severity, 'simple')

    await adjustIntegrity(fx.item.id, { malfunction: null })
    assert.equal((await readItem(fx.item.id)).malfunction_severity, null)
  } finally {
    await cleanup(fx)
  }
})

test('adjustIntegrity — cohérence : courante > max, max > 25, une seule des deux → 400', { skip }, async () => {
  const fx = await createFixture({ current: 10, max: 15 })
  try {
    await assert.rejects(() => adjustIntegrity(fx.item.id, { current: 30, max: 20 }), (e) => e instanceof AppError && e.statusCode === 400)
    await assert.rejects(() => adjustIntegrity(fx.item.id, { current: 10, max: 40 }), (e) => e.statusCode === 400)
    await assert.rejects(() => adjustIntegrity(fx.item.id, { current: 5, max: null }), (e) => e.statusCode === 400) // une seule des deux
    const after = await readItem(fx.item.id)
    assert.equal(after.integrity_current, 10, 'aucune écriture partielle sur rejet')
    // courante seule, cohérente avec le max existant : accepté
    await adjustIntegrity(fx.item.id, { current: 5 })
    assert.equal((await readItem(fx.item.id)).integrity_current, 5)
  } finally {
    await cleanup(fx)
  }
})

test('adjustIntegrity — objet sans has_integrity → 400', { skip }, async () => {
  const fx = await createFixture({ hasIntegrity: false })
  try {
    await assert.rejects(() => adjustIntegrity(fx.item.id, { current: 10, max: 15 }), (e) => e instanceof AppError && e.statusCode === 400)
  } finally {
    await cleanup(fx)
  }
})

// ── applyPanneSystematic ────────────────────────────────────────────────────
test('applyPanneSystematic — −1 ITG, malfunction simple ; à 0 → critical (RAW « hors d\'usage »)', { skip }, async () => {
  const fx = await createFixture({ current: 5, max: 15 })
  try {
    const r = await applyPanneSystematic(fx.item.id, { reason: 'intensive' })
    assert.equal(r.panne, 'simple')
    assert.equal(r.loss, 1)
    // 5 → 4 : reste dans le palier « Endommagé » (1-5), aucun franchissement → newMax inchangé
    assert.deepEqual(r.after, { current: 4, max: 15, malfunction_severity: 'simple' })
    const row = await readItem(fx.item.id)
    assert.equal(row.integrity_current, 4)
    assert.equal(row.malfunction_severity, 'simple')

    // amène à 1, puis panne → 0
    await adjustIntegrity(fx.item.id, { current: 1, max: 15, malfunction: null })
    const r2 = await applyPanneSystematic(fx.item.id, {})
    assert.equal(r2.after.current, 0)
    assert.equal(r2.after.max, 14, 'franchit endommagé→hors d\'usage : −1 ITG max définitif')
    assert.equal(r2.after.malfunction_severity, 'critical', 'ITG 0 force critical même en panne simple')
  } finally {
    await cleanup(fx)
  }
})

test('applyPanneSystematic — objet sans ITG → skipped', { skip }, async () => {
  const fx = await createFixture({ hasIntegrity: false })
  try {
    const r = await applyPanneSystematic(fx.item.id, {})
    assert.equal(r.panne, 'skipped')
  } finally {
    await cleanup(fx)
  }
})

// ── runPanneTest ────────────────────────────────────────────────────────────
test('runPanneTest — ITG 25 : 1D20 ≤ 25 toujours → réussite, aucune écriture', { skip }, async () => {
  const fx = await createFixture({ current: 25, max: 25 })
  try {
    const r = await runPanneTest(fx.item.id, { reason: 'combat_low_itg' })
    assert.equal(r.panne, 'ok')
    assert.equal(r.loss, 0)
    assert.deepEqual(r.after, r.before)
    const row = await readItem(fx.item.id)
    assert.equal(row.integrity_current, 25)
    assert.equal(row.malfunction_severity, null)
  } finally {
    await cleanup(fx)
  }
})

test('runPanneTest — ITG basse : invariants sur 40 tirages', { skip }, async () => {
  const fx = await createFixture({ current: 4, max: 10 })
  try {
    for (let i = 0; i < 40; i++) {
      await adjustIntegrity(fx.item.id, { current: 4, max: 10, malfunction: null })
      const r = await runPanneTest(fx.item.id, { reason: 'combat_low_itg' })
      assert.ok(['ok', 'simple', 'critical'].includes(r.panne), `panne = ${r.panne}`)
      assert.ok(r.roll >= 1 && r.roll <= 20)
      assert.ok(r.after.current <= r.before.current, 'ITG ne remonte jamais')
      assert.ok(r.after.current >= 0 && r.after.current <= r.after.max)
      if (r.panne === 'ok') {
        assert.equal(r.loss, 0)
        assert.deepEqual(r.after, r.before)
      } else {
        assert.ok(r.after.malfunction_severity != null, 'panne → malfunction posé')
        if (r.panne === 'simple') assert.equal(r.loss, 1)
        if (r.panne === 'critical') assert.ok(r.loss >= 1 && r.loss <= 6)
        assert.equal(r.after.current, Math.max(0, r.before.current - r.loss))
      }
    }
  } finally {
    await cleanup(fx)
  }
})

test('runPanneTest — objet sans ITG → skipped', { skip }, async () => {
  const fx = await createFixture({ hasIntegrity: false })
  try {
    const r = await runPanneTest(fx.item.id, {})
    assert.equal(r.panne, 'skipped')
  } finally {
    await cleanup(fx)
  }
})

// ── Concurrence — .forUpdate() sérialise ─────────────────────────────────────
test('concurrence — deux applyPanneSystematic simultanés : perte cumulée, pas de lost-update', { skip }, async () => {
  const fx = await createFixture({ current: 10, max: 15 })
  try {
    await Promise.all([
      applyPanneSystematic(fx.item.id, {}),
      applyPanneSystematic(fx.item.id, {}),
    ])
    const row = await readItem(fx.item.id)
    assert.equal(row.integrity_current, 8, 'deux fois −1, jamais une seule (le verrou a sérialisé)')
  } finally {
    await cleanup(fx)
  }
})

// ── L3 — ITG à l'acquisition ────────────────────────────────────────────────
test('computeAcquisitionIntegrity — marché noir : neuf (courante = max de la qualité)', async () => {
  const r = await computeAcquisitionIntegrity({ quality: 'standard', isBlackMarket: true })
  assert.deepEqual(r, { integrity_current: 15, integrity_max: 15 })
  const r2 = await computeAcquisitionIntegrity({ quality: 'excellente', isBlackMarket: true })
  assert.deepEqual(r2, { integrity_current: 25, integrity_max: 25 })
})

test('computeAcquisitionIntegrity — marché légal : occasion (jet plafonné au max)', async () => {
  for (const [key, q] of Object.entries(QUALITY_TABLE)) {
    for (let i = 0; i < 20; i++) {
      const r = await computeAcquisitionIntegrity({ quality: key, isBlackMarket: false })
      assert.equal(r.integrity_max, q.itgMax, key)
      assert.ok(r.integrity_current >= 1 && r.integrity_current <= q.itgMax, `${key} courante ${r.integrity_current}`)
    }
  }
})

test('computeAcquisitionIntegrity — qualité NULL → bonne_qualite (max 20)', async () => {
  const r = await computeAcquisitionIntegrity({ quality: null, isBlackMarket: true })
  assert.deepEqual(r, { integrity_current: 20, integrity_max: 20 })
})

test('rollOccasionIntegrity — pose max de la qualité + courante d\'occasion', { skip }, async () => {
  const fx = await createFixture({ current: null, max: null, hasIntegrity: true })
  try {
    // pas d'ITG au départ (createFixture avec current/max null n'insère pas les colonnes)
    const r = await rollOccasionIntegrity(fx.owner.id, fx.item.id)
    const q = QUALITY_TABLE[fx.ref.quality] ?? QUALITY_TABLE.bonne_qualite
    assert.equal(r.after.max, q.itgMax)
    assert.ok(r.after.current >= 1 && r.after.current <= q.itgMax)
    const row = await readItem(fx.item.id)
    assert.equal(row.integrity_max, q.itgMax)
  } finally {
    await cleanup(fx)
  }
})

test('rollOccasionIntegrity — mauvais characterId → 404', { skip }, async () => {
  const fx = await createFixture()
  try {
    await assert.rejects(
      () => rollOccasionIntegrity('00000000-0000-0000-0000-000000000000', fx.item.id),
      (e) => e instanceof AppError && e.statusCode === 404,
    )
  } finally {
    await cleanup(fx)
  }
})

test.after(async () => { await db.destroy() })
