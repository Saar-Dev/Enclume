import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { runPanneTest, applyPanneSystematic, adjustIntegrity, computeAcquisitionIntegrity, rollOccasionIntegrity, applyRepairOutcome, EXO_COMPUTER_ADAPTER, EXO_SYSTEM_ADAPTER, EXO_WEAPON_ADAPTER, EXO_EXOSQUELETTE_ADAPTER, EXO_GENERATOR_ADAPTER } from './integrityService.js'
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

// Fixture exo_computers (Lot 2, PLAN_INFORMATIQUE.md §4 Lot 2) — même patron que createFixture,
// pour l'adaptateur `EXO_COMPUTER_ADAPTER` de runPanneTest. `current: null` → integrite_current
// jamais posée (dispositif optionnel réglé à la main, cf. commentaire de l'adaptateur).
async function createExoFixture({ current = 10, max = 15 } = {}) {
  const [gm] = await db('users')
    .insert({ email: `itg-exo-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'itg-exo-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test integrityService exo', invite_code: `ITGEXO-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [exoCharacter] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Exo test integrityService', type: 'exo' })
    .returning('*')
  await db('exo_sheet').insert({ character_id: exoCharacter.id })
  const insert = { character_id: exoCharacter.id, role: 'principal', gen: 3, nt: 2 }
  if (current != null) { insert.integrite_current = current; insert.integrite_max = max }
  const [computer] = await db('exo_computers').insert(insert).returning('*')
  return { gm, campaign, exoCharacter, computer }
}
const readComputer = (id) => db('exo_computers').where({ id }).first()

// Fixtures Lot 2bis (PLAN_INFORMATIQUE.md §4 Lot 2bis) — Attaque IEM sur exo-armure, 4 adaptateurs
// (EXO_SYSTEM/EXO_WEAPON/EXO_EXOSQUELETTE/EXO_GENERATOR). Même patron que createExoFixture.
async function createExoSystemFixture({ current = 10, max = 15 } = {}) {
  const [gm] = await db('users')
    .insert({ email: `itg-exosys-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'itg-exosys-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test integrityService exo-systeme', invite_code: `ITGEXOSYS-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [exoCharacter] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Exo test integrityService systeme', type: 'exo' })
    .returning('*')
  await db('exo_sheet').insert({ character_id: exoCharacter.id })
  const insert = { character_id: exoCharacter.id, label_override: 'Systeme test integrityService' }
  if (current != null) { insert.integrite_current = current; insert.integrite_max = max }
  const [system] = await db('exo_systems').insert(insert).returning('*')
  return { gm, campaign, exoCharacter, system }
}
const readSystem = (id) => db('exo_systems').where({ id }).first()

async function createExoWeaponFixture({ current = 10, max = 15 } = {}) {
  const [gm] = await db('users')
    .insert({ email: `itg-exowpn-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'itg-exowpn-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test integrityService exo-arme', invite_code: `ITGEXOWPN-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [exoCharacter] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Exo test integrityService arme', type: 'exo' })
    .returning('*')
  await db('exo_sheet').insert({ character_id: exoCharacter.id })
  const insert = { character_id: exoCharacter.id, label_override: 'Arme test integrityService' }
  if (current != null) { insert.integrite_current = current; insert.integrite_max = max }
  const [weapon] = await db('exo_weapons').insert(insert).returning('*')
  return { gm, campaign, exoCharacter, weapon }
}
const readWeapon = (id) => db('exo_weapons').where({ id }).first()

// Exosquelette/Générateur : pas de ligne dédiée, l'adaptateur adresse `exo_sheet` par `character_id`
// — `id` passé à `runPanneTest` est donc directement `exoCharacter.id`, jamais un id de ligne séparé.
// `itg_exosquelette_current`/`itg_generator_current` sont NOT NULL (défaut 20, migration 44) —
// composants obligatoires de toute exo-armure, aucun `current: null` à couvrir ici (contrairement à
// `exo_computers`/`exo_systems`/`exo_weapons`, dispositifs/équipements facultatifs).
async function createExoSheetFixture({ exosqueletteCurrent = 10, exosqueletteMax = 15, generatorCurrent = 10, generatorMax = 15 } = {}) {
  const [gm] = await db('users')
    .insert({ email: `itg-exosheet-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'itg-exosheet-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test integrityService exo-sheet', invite_code: `ITGEXOSHEET-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [exoCharacter] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Exo test integrityService sheet', type: 'exo' })
    .returning('*')
  await db('exo_sheet').insert({
    character_id: exoCharacter.id,
    itg_exosquelette_current: exosqueletteCurrent, itg_exosquelette_max: exosqueletteMax,
    itg_generator_current: generatorCurrent, itg_generator_max: generatorMax,
  })
  return { gm, campaign, exoCharacter }
}
const readSheet = (characterId) => db('exo_sheet').where({ character_id: characterId }).first()

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
    // L5c — le retour porte de quoi émettre une carte DICE_RESULT reproductible, y compris sur 'ok'.
    assert.ok(r.seed != null && r.seed !== '', 'seed présent')
    assert.equal(typeof r.isCriticalFail, 'boolean')
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
      assert.ok(r.seed != null && r.seed !== '', 'seed présent (carte DICE_RESULT L5c)')
      assert.equal(typeof r.isCriticalFail, 'boolean')
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

test('runPanneTest / applyPanneSystematic — scoping characterId (L7) : mauvais perso → 404', { skip }, async () => {
  const fx = await createFixture({ current: 4, max: 10 })
  const bad = '00000000-0000-0000-0000-000000000000'
  try {
    await assert.rejects(() => runPanneTest(fx.item.id, { characterId: bad }), (e) => e instanceof AppError && e.statusCode === 404)
    await assert.rejects(() => applyPanneSystematic(fx.item.id, { characterId: bad }), (e) => e instanceof AppError && e.statusCode === 404)
    // bon perso : passe
    const ok = await applyPanneSystematic(fx.item.id, { characterId: fx.owner.id })
    assert.equal(ok.panne, 'simple')
  } finally {
    await cleanup(fx)
  }
})

// ── runPanneTest — Lot 2 (PLAN_INFORMATIQUE.md §4 Lot 2) : modifier, mr, adaptateur exo_computers ──
test('runPanneTest — modifier optionnel décale le seuil testé (malus/bonus IEM)', { skip }, async () => {
  const fx = await createFixture({ current: 25, max: 25 })
  try {
    const r = await runPanneTest(fx.item.id, { reason: 'test_iem', modifier: -5 })
    assert.equal(r.modifier, -5)
    assert.equal(r.threshold, 20, 'seuil testé = current + modifier, jamais current seul')
  } finally {
    await cleanup(fx)
  }
})

test('runPanneTest — sans modifier, threshold reste identique au comportement historique', { skip }, async () => {
  const fx = await createFixture({ current: 12, max: 15 })
  try {
    const r = await runPanneTest(fx.item.id, { reason: 'combat_low_itg' })
    assert.equal(r.modifier, 0)
    assert.equal(r.threshold, 12)
  } finally {
    await cleanup(fx)
  }
})

test('runPanneTest — mr signé présent dans le retour (consommé par le Lot 3, Survie I.E.M.)', { skip }, async () => {
  const fx = await createFixture({ current: 25, max: 25 })
  try {
    const r = await runPanneTest(fx.item.id, {})
    assert.equal(typeof r.mr, 'number')
    assert.ok(r.isCriticalFail || r.panne !== 'skipped')
  } finally {
    await cleanup(fx)
  }
})

test('runPanneTest — adaptateur exo_computers : lit/écrit integrite_current/max, jamais char_inventory', { skip }, async () => {
  const fx = await createExoFixture({ current: 4, max: 10 })
  try {
    for (let i = 0; i < 20; i++) {
      await db('exo_computers').where({ id: fx.computer.id }).update({ integrite_current: 4, integrite_max: 10, malfunction_severity: null })
      const r = await runPanneTest(fx.computer.id, { reason: 'iem_hit', adapter: EXO_COMPUTER_ADAPTER })
      assert.ok(['ok', 'simple', 'critical'].includes(r.panne), `panne = ${r.panne}`)
      const row = await readComputer(fx.computer.id)
      assert.equal(row.integrite_current, r.after.current, 'écriture sur exo_computers, colonnes FR')
      assert.equal(row.malfunction_severity, r.after.malfunction_severity)
      if (r.panne !== 'ok') assert.ok(row.malfunction_severity != null)
    }
  } finally {
    await db('campaigns').where({ id: fx.campaign.id }).del()
    await db('users').where({ id: fx.gm.id }).del()
  }
})

test('runPanneTest — adaptateur exo_computers : integrite_current NULL (dispositif non réglé) → skipped', { skip }, async () => {
  const fx = await createExoFixture({ current: null })
  try {
    const r = await runPanneTest(fx.computer.id, { adapter: EXO_COMPUTER_ADAPTER })
    assert.equal(r.panne, 'skipped')
  } finally {
    await db('campaigns').where({ id: fx.campaign.id }).del()
    await db('users').where({ id: fx.gm.id }).del()
  }
})

test('runPanneTest — adaptateur exo_computers : mauvais characterId → 404', { skip }, async () => {
  const fx = await createExoFixture({ current: 8, max: 10 })
  const bad = '00000000-0000-0000-0000-000000000000'
  try {
    await assert.rejects(
      () => runPanneTest(fx.computer.id, { characterId: bad, adapter: EXO_COMPUTER_ADAPTER }),
      (e) => e instanceof AppError && e.statusCode === 404,
    )
  } finally {
    await db('campaigns').where({ id: fx.campaign.id }).del()
    await db('users').where({ id: fx.gm.id }).del()
  }
})

// ── runPanneTest — Lot 2bis (PLAN_INFORMATIQUE.md §4 Lot 2bis) : 4 adaptateurs Attaque IEM exo ──
test('runPanneTest — adaptateur exo_systems : lit/écrit integrite_current/max', { skip }, async () => {
  const fx = await createExoSystemFixture({ current: 4, max: 10 })
  try {
    for (let i = 0; i < 20; i++) {
      await db('exo_systems').where({ id: fx.system.id }).update({ integrite_current: 4, integrite_max: 10, malfunction_severity: null })
      const r = await runPanneTest(fx.system.id, { reason: 'iem_hit', adapter: EXO_SYSTEM_ADAPTER })
      assert.ok(['ok', 'simple', 'critical'].includes(r.panne), `panne = ${r.panne}`)
      const row = await readSystem(fx.system.id)
      assert.equal(row.integrite_current, r.after.current)
      assert.equal(row.malfunction_severity, r.after.malfunction_severity)
    }
  } finally {
    await db('campaigns').where({ id: fx.campaign.id }).del()
    await db('users').where({ id: fx.gm.id }).del()
  }
})

test('runPanneTest — adaptateur exo_systems : integrite_current NULL → skipped ; mauvais characterId → 404', { skip }, async () => {
  const fxSkip = await createExoSystemFixture({ current: null })
  const fx = await createExoSystemFixture({ current: 8, max: 10 })
  const bad = '00000000-0000-0000-0000-000000000000'
  try {
    const r = await runPanneTest(fxSkip.system.id, { adapter: EXO_SYSTEM_ADAPTER })
    assert.equal(r.panne, 'skipped')
    await assert.rejects(
      () => runPanneTest(fx.system.id, { characterId: bad, adapter: EXO_SYSTEM_ADAPTER }),
      (e) => e instanceof AppError && e.statusCode === 404,
    )
  } finally {
    await db('campaigns').where({ id: fxSkip.campaign.id }).del()
    await db('users').where({ id: fxSkip.gm.id }).del()
    await db('campaigns').where({ id: fx.campaign.id }).del()
    await db('users').where({ id: fx.gm.id }).del()
  }
})

test('runPanneTest — adaptateur exo_weapons : lit/écrit integrite_current/max', { skip }, async () => {
  const fx = await createExoWeaponFixture({ current: 4, max: 10 })
  try {
    for (let i = 0; i < 20; i++) {
      await db('exo_weapons').where({ id: fx.weapon.id }).update({ integrite_current: 4, integrite_max: 10, malfunction_severity: null })
      const r = await runPanneTest(fx.weapon.id, { reason: 'iem_hit', adapter: EXO_WEAPON_ADAPTER })
      assert.ok(['ok', 'simple', 'critical'].includes(r.panne), `panne = ${r.panne}`)
      const row = await readWeapon(fx.weapon.id)
      assert.equal(row.integrite_current, r.after.current)
      assert.equal(row.malfunction_severity, r.after.malfunction_severity)
    }
  } finally {
    await db('campaigns').where({ id: fx.campaign.id }).del()
    await db('users').where({ id: fx.gm.id }).del()
  }
})

test('runPanneTest — adaptateur exo_weapons : integrite_current NULL → skipped ; mauvais characterId → 404', { skip }, async () => {
  const fxSkip = await createExoWeaponFixture({ current: null })
  const fx = await createExoWeaponFixture({ current: 8, max: 10 })
  const bad = '00000000-0000-0000-0000-000000000000'
  try {
    const r = await runPanneTest(fxSkip.weapon.id, { adapter: EXO_WEAPON_ADAPTER })
    assert.equal(r.panne, 'skipped')
    await assert.rejects(
      () => runPanneTest(fx.weapon.id, { characterId: bad, adapter: EXO_WEAPON_ADAPTER }),
      (e) => e instanceof AppError && e.statusCode === 404,
    )
  } finally {
    await db('campaigns').where({ id: fxSkip.campaign.id }).del()
    await db('users').where({ id: fxSkip.gm.id }).del()
    await db('campaigns').where({ id: fx.campaign.id }).del()
    await db('users').where({ id: fx.gm.id }).del()
  }
})

test('runPanneTest — adaptateur exo_sheet/Exosquelette : lit/écrit itg_exosquelette_current/max, id = character_id', { skip }, async () => {
  const fx = await createExoSheetFixture({ exosqueletteCurrent: 4, exosqueletteMax: 10 })
  try {
    for (let i = 0; i < 20; i++) {
      await db('exo_sheet').where({ character_id: fx.exoCharacter.id }).update({ itg_exosquelette_current: 4, itg_exosquelette_max: 10, exosquelette_malfunction_severity: null })
      const r = await runPanneTest(fx.exoCharacter.id, { reason: 'iem_hit', adapter: EXO_EXOSQUELETTE_ADAPTER })
      assert.ok(['ok', 'simple', 'critical'].includes(r.panne), `panne = ${r.panne}`)
      const row = await readSheet(fx.exoCharacter.id)
      assert.equal(row.itg_exosquelette_current, r.after.current)
      assert.equal(row.exosquelette_malfunction_severity, r.after.malfunction_severity)
      // Le générateur, colonnes sœurs sur la même ligne, n'est jamais touché par cet adaptateur.
      assert.equal(row.itg_generator_current, 10)
    }
  } finally {
    await db('campaigns').where({ id: fx.campaign.id }).del()
    await db('users').where({ id: fx.gm.id }).del()
  }
})

test('runPanneTest — adaptateur exo_sheet/Générateur : lit/écrit itg_generator_current/max, id = character_id', { skip }, async () => {
  const fx = await createExoSheetFixture({ generatorCurrent: 4, generatorMax: 10 })
  try {
    for (let i = 0; i < 20; i++) {
      await db('exo_sheet').where({ character_id: fx.exoCharacter.id }).update({ itg_generator_current: 4, itg_generator_max: 10, generator_malfunction_severity: null })
      const r = await runPanneTest(fx.exoCharacter.id, { reason: 'iem_hit', adapter: EXO_GENERATOR_ADAPTER })
      assert.ok(['ok', 'simple', 'critical'].includes(r.panne), `panne = ${r.panne}`)
      const row = await readSheet(fx.exoCharacter.id)
      assert.equal(row.itg_generator_current, r.after.current)
      assert.equal(row.generator_malfunction_severity, r.after.malfunction_severity)
      assert.equal(row.itg_exosquelette_current, 10)
    }
  } finally {
    await db('campaigns').where({ id: fx.campaign.id }).del()
    await db('users').where({ id: fx.gm.id }).del()
  }
})

test('runPanneTest — adaptateurs exo_sheet : characterId incohérent avec id (convention id=character_id) → 404', { skip }, async () => {
  const fx = await createExoSheetFixture({ exosqueletteCurrent: 8, exosqueletteMax: 10 })
  const bad = '00000000-0000-0000-0000-000000000000'
  try {
    await assert.rejects(
      () => runPanneTest(fx.exoCharacter.id, { characterId: bad, adapter: EXO_EXOSQUELETTE_ADAPTER }),
      (e) => e instanceof AppError && e.statusCode === 404,
    )
    await assert.rejects(
      () => runPanneTest(fx.exoCharacter.id, { characterId: bad, adapter: EXO_GENERATOR_ADAPTER }),
      (e) => e instanceof AppError && e.statusCode === 404,
    )
    // characterId cohérent (= id) : passe
    const ok = await runPanneTest(fx.exoCharacter.id, { characterId: fx.exoCharacter.id, adapter: EXO_EXOSQUELETTE_ADAPTER })
    assert.ok(['ok', 'simple', 'critical'].includes(ok.panne))
  } finally {
    await db('campaigns').where({ id: fx.campaign.id }).del()
    await db('users').where({ id: fx.gm.id }).del()
  }
})

// ── applyRepairOutcome (MANUEL §5.1, L6) ────────────────────────────────────
test('applyRepairOutcome — réussite : ITG courante += MR (plafonné), lève une panne simple', { skip }, async () => {
  const fx = await createFixture({ current: 10, max: 15 })
  try {
    await db('char_inventory').where({ id: fx.item.id }).update({ malfunction_severity: 'simple' })
    const r = await applyRepairOutcome(fx.item.id, { outcome: { isSuccess: true, mr: 4, roll: 8, threshold: 12, seed: 's' } })
    assert.equal(r.repair, 'success')
    assert.equal(r.points, 4)
    assert.equal(r.after.current, 14)
    assert.equal(r.after.max, 15)
    assert.equal(r.after.malfunction_severity, null, 'panne simple levée')
  } finally { await cleanup(fx) }
})

test('applyRepairOutcome — réussite plafonnée au max, panne critique NON levée par ce chemin', { skip }, async () => {
  const fx = await createFixture({ current: 12, max: 15 })
  try {
    await db('char_inventory').where({ id: fx.item.id }).update({ malfunction_severity: 'critical' })
    const r = await applyRepairOutcome(fx.item.id, { outcome: { isSuccess: true, mr: 10 } })
    assert.equal(r.after.current, 15, 'plafonné')
    assert.equal(r.after.malfunction_severity, 'critical', 'critical reste (atelier, hors ce flux)')
  } finally { await cleanup(fx) }
})

test('applyRepairOutcome — échec simple : aucun changement', { skip }, async () => {
  const fx = await createFixture({ current: 9, max: 15 })
  try {
    await db('char_inventory').where({ id: fx.item.id }).update({ malfunction_severity: 'simple' })
    const r = await applyRepairOutcome(fx.item.id, { outcome: { isSuccess: false, catastropheRisk: false } })
    assert.equal(r.repair, 'failure')
    assert.deepEqual(r.after, r.before)
    const row = await readItem(fx.item.id)
    assert.equal(row.integrity_current, 9)
    assert.equal(row.malfunction_severity, 'simple')
  } finally { await cleanup(fx) }
})

test('applyRepairOutcome — Catastrophe : −1 ITG max, courante ramenée sous le max, panne inchangée', { skip }, async () => {
  const fx = await createFixture({ current: 15, max: 15 })
  try {
    await db('char_inventory').where({ id: fx.item.id }).update({ malfunction_severity: 'simple' })
    const r = await applyRepairOutcome(fx.item.id, { outcome: { isSuccess: false, catastropheRisk: true } })
    assert.equal(r.repair, 'catastrophe')
    assert.equal(r.definitiveLoss, 1)
    assert.equal(r.after.max, 14)
    assert.equal(r.after.current, 14, 'courante clampée au nouveau max')
    assert.equal(r.after.malfunction_severity, 'simple', 'RAW « reste en panne » = inchangé')
  } finally { await cleanup(fx) }
})

test('applyRepairOutcome — Catastrophe plancher : ITG max ne descend pas sous 1', { skip }, async () => {
  const fx = await createFixture({ current: 1, max: 1 })
  try {
    const r = await applyRepairOutcome(fx.item.id, { outcome: { isSuccess: false, catastropheRisk: true } })
    assert.equal(r.after.max, 1)
    assert.equal(r.after.current, 1)
  } finally { await cleanup(fx) }
})

test('applyRepairOutcome — objet sans ITG → skipped', { skip }, async () => {
  const fx = await createFixture({ hasIntegrity: false })
  try {
    const r = await applyRepairOutcome(fx.item.id, { outcome: { isSuccess: true, mr: 3 } })
    assert.equal(r.repair, 'skipped')
  } finally { await cleanup(fx) }
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
