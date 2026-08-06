import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { CATASTROPHE_EFFECT_TABLE, findCatastropheEntry } from '../../../shared/catastropheEffectTable.js'
import {
  rollCatastropheEffect, isCombatActive, createPendingCatastrophe, resolvePendingCatastrophe,
  maybeTriggerCatastrophe, listPendingCatastrophes,
} from './catastropheService.js'

// Lancement manuel : node --env-file=../.env --test server/src/lib/catastropheService.test.mjs
const skip = !process.env.DATABASE_URL

// fakeIo — aucun test ici ne vérifie le contenu des broadcasts (couvert manuellement, §7 du plan),
// seulement l'état persisté et l'idempotence — même esprit que gameTimeService.test.mjs qui commit
// réellement puis nettoie explicitement (io réel non nécessaire, pas de room Socket.IO en jeu).
const fakeIo = { to: () => ({ emit: () => {} }) }

async function createRealFixture() {
  const [user] = await db('users')
    .insert({ email: `cats-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'cats-test' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: user.id, name: 'Campagne test catastrophe', invite_code: `CATS-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [battlemap] = await db('battlemaps')
    .insert({ campaign_id: campaign.id, name: 'Battlemap test catastrophe' })
    .returning('*')
  const [token] = await db('tokens')
    .insert({ battlemap_id: battlemap.id, label: 'Token test catastrophe' })
    .returning('*')
  return { user, campaign, battlemap, token }
}

async function cleanup({ user, campaign }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (user) await db('users').where({ id: user.id }).del()
}

// ─── CATASTROPHE_EFFECT_TABLE — pure, pas de DB ──────────────────────────────────────────────

test('CATASTROPHE_EFFECT_TABLE couvre 1-10 sans trou et findCatastropheEntry ne throw jamais', () => {
  assert.equal(CATASTROPHE_EFFECT_TABLE.length, 10)
  for (let i = 1; i <= 10; i++) {
    const entry = findCatastropheEntry(i)
    assert.ok(entry, `entrée manquante pour l'index ${i}`)
    assert.equal(entry.index, i)
    assert.equal(typeof entry.key, 'string')
  }
  assert.equal(findCatastropheEntry(0), undefined)
  assert.equal(findCatastropheEntry(11), undefined)
})

// ─── rollCatastropheEffect — distribution, jamais hors table ─────────────────────────────────

test('rollCatastropheEffect retourne toujours une entrée valide de la table (100 tirages)', { skip }, async () => {
  for (let i = 0; i < 100; i++) {
    const entry = await rollCatastropheEffect()
    assert.ok(entry)
    assert.ok(entry.index >= 1 && entry.index <= 10)
  }
})

// ─── isCombatActive ───────────────────────────────────────────────────────────────────────────

test('isCombatActive reflète l\'existence de la ligne combat_state, pas une valeur de phase', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    assert.equal(await isCombatActive(fixture.campaign.id), false)

    await db('combat_state').insert({ campaign_id: fixture.campaign.id, phase: 'ROSTER' })
    assert.equal(await isCombatActive(fixture.campaign.id), true)

    await db('combat_state').where({ campaign_id: fixture.campaign.id }).update({ phase: 'RESOLUTION' })
    assert.equal(await isCombatActive(fixture.campaign.id), true)

    await db('combat_state').where({ campaign_id: fixture.campaign.id }).delete()
    assert.equal(await isCombatActive(fixture.campaign.id), false)
  } finally {
    await cleanup(fixture)
  }
})

// ─── maybeTriggerCatastrophe — garde combat actif + catastropheRisk ──────────────────────────

test('maybeTriggerCatastrophe : no-op hors combat ou sans risque, crée une ligne sinon', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    // Hors combat, même avec catastropheRisk=true → pas de ligne créée (décision 1 du plan).
    let result = await maybeTriggerCatastrophe(fakeIo, fixture.campaign.id, fixture.token.id, true, { site: 'test' })
    assert.equal(result, null)
    assert.equal((await listPendingCatastrophes(fixture.campaign.id)).length, 0)

    // En combat mais catastropheRisk=false → pas de ligne créée.
    await db('combat_state').insert({ campaign_id: fixture.campaign.id, phase: 'RESOLUTION' })
    result = await maybeTriggerCatastrophe(fakeIo, fixture.campaign.id, fixture.token.id, false, { site: 'test' })
    assert.equal(result, null)
    assert.equal((await listPendingCatastrophes(fixture.campaign.id)).length, 0)

    // En combat + catastropheRisk=true → ligne créée, table_entry dans [1,10].
    result = await maybeTriggerCatastrophe(fakeIo, fixture.campaign.id, fixture.token.id, true, { site: 'test' })
    assert.ok(result)
    assert.ok(result.table_entry >= 1 && result.table_entry <= 10)
    assert.equal(result.applied_entry, null)
    assert.equal(result.resolved_at, null)
  } finally {
    await cleanup(fixture)
  }
})

// ─── resolvePendingCatastrophe — idempotence + override ──────────────────────────────────────

test('resolvePendingCatastrophe : confirme le jet tel quel, jamais deux fois', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('combat_state').insert({ campaign_id: fixture.campaign.id, phase: 'RESOLUTION' })
    const pending = await createPendingCatastrophe(fakeIo, fixture.campaign.id, fixture.token.id, { site: 'test' })

    const resolved = await resolvePendingCatastrophe(fakeIo, fixture.campaign.id, pending.id, {})
    assert.ok(resolved)
    assert.equal(resolved.applied_entry, pending.table_entry)
    assert.ok(resolved.resolved_at)

    // Idempotence : un second appel sur la même entrée ne l'applique pas deux fois.
    const secondAttempt = await resolvePendingCatastrophe(fakeIo, fixture.campaign.id, pending.id, {})
    assert.equal(secondAttempt, null)
  } finally {
    await cleanup(fixture)
  }
})

test('resolvePendingCatastrophe : override applique l\'entrée choisie par le MJ, pas le jet original', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('combat_state').insert({ campaign_id: fixture.campaign.id, phase: 'RESOLUTION' })
    const pending = await createPendingCatastrophe(fakeIo, fixture.campaign.id, fixture.token.id, { site: 'test' })

    const overrideValue = pending.table_entry === 10 ? 1 : pending.table_entry + 1
    const resolved = await resolvePendingCatastrophe(fakeIo, fixture.campaign.id, pending.id, { override: overrideValue })
    assert.equal(resolved.table_entry, pending.table_entry) // jet original jamais réécrit
    assert.equal(resolved.applied_entry, overrideValue)
  } finally {
    await cleanup(fixture)
  }
})

test('resolvePendingCatastrophe : override hors 1-10 rejeté avant toute écriture', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await db('combat_state').insert({ campaign_id: fixture.campaign.id, phase: 'RESOLUTION' })
    const pending = await createPendingCatastrophe(fakeIo, fixture.campaign.id, fixture.token.id, { site: 'test' })

    await assert.rejects(
      resolvePendingCatastrophe(fakeIo, fixture.campaign.id, pending.id, { override: 999 }),
      /hors de la table/,
    )

    // La ligne doit rester intacte (pas d'écriture partielle) — toujours résolvable normalement ensuite.
    const stillPending = await listPendingCatastrophes(fixture.campaign.id)
    assert.equal(stillPending.length, 1)
    assert.equal(stillPending[0].id, pending.id)

    const resolved = await resolvePendingCatastrophe(fakeIo, fixture.campaign.id, pending.id, {})
    assert.ok(resolved)
  } finally {
    await cleanup(fixture)
  }
})

test.after(async () => { await db.destroy() })
