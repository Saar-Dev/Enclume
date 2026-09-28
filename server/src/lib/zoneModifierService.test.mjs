import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import {
  applyZoneModifier, clearZoneModifier, resolveZoneModifierTicks, resolveZoneModifierMalus,
} from './zoneModifierService.js'

// Lancement (depuis la racine) : node --env-file=.env --test server/src/lib/zoneModifierService.test.mjs
// Écrit puis supprime des lignes dans la base locale — sans DATABASE_URL, tout est ignoré.
const skip = !process.env.DATABASE_URL

test.after(async () => { await db.destroy() })

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`
const fakeIo = { to: () => ({ emit: () => {} }) }

async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `zms-${uniq()}@test.local`, password_hash: 'x', username: 'zms-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test zoneModifier', invite_code: `ZMS-${uniq()}` })
    .returning('*')
  const [battlemap] = await db('battlemaps').insert({ campaign_id: campaign.id, name: 'BM test' }).returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Cible test', type: 'pj' })
    .returning('*')
  const [token] = await db('tokens')
    .insert({ battlemap_id: battlemap.id, character_id: character.id, label: 'Cible' })
    .returning('*')
  return { gm, campaign, battlemap, character, token }
}

async function cleanup({ campaign, gm, character, token }) {
  await db('token_statuses').where({ token_id: token.id }).del()
  await db('tokens').where({ id: token.id }).del()
  await db('characters').where({ id: character.id }).del()
  await db('battlemaps').where({ campaign_id: campaign.id }).del()
  await db('campaigns').where({ id: campaign.id }).del()
  await db('users').where({ id: gm.id }).del()
}

test('applyZoneModifier — pose sans escalation : value = celle de la ligne, kind marqué', { skip }, async () => {
  const fx = await createFixture()
  try {
    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:irritant', {
      zoneInstanceId: 'zone-1', target: 'actions', value: -3, escalation: null,
      remanence: 'decay', remanenceParams: { perTurn: 1 }, currentTurn: 1,
    })
    const row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:irritant' }).first()
    assert.equal(row.data.kind, 'zoneModifier')
    assert.equal(row.data.value, -3)
    assert.equal(row.data.escalationStacks, 0)
    assert.equal(row.data.lastRefreshedTurn, 1)
  } finally {
    await cleanup(fx)
  }
})

test('applyZoneModifier — escalation : la magnitude s\'éloigne de zéro d\'un cran par rafraîchissement dans la MÊME zone, plafonnée par cap', { skip }, async () => {
  const fx = await createFixture()
  try {
    const opts = {
      zoneInstanceId: 'zone-1', target: 'actions', value: -3,
      escalation: { perTurn: 2, cap: 5 }, remanence: 'decay', remanenceParams: { perTurn: 1 },
    }
    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:decomposant-modifier-test', { ...opts, currentTurn: 1 })
    let row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:decomposant-modifier-test' }).first()
    assert.equal(row.data.escalationStacks, 0)
    assert.equal(row.data.value, -3, '1ère pose : aucune escalade, cran 0')

    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:decomposant-modifier-test', { ...opts, currentTurn: 2 })
    row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:decomposant-modifier-test' }).first()
    assert.equal(row.data.escalationStacks, 1)
    assert.equal(row.data.value, -5, '-3 + perTurn(2) × 1 cran')

    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:decomposant-modifier-test', { ...opts, currentTurn: 3 })
    row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:decomposant-modifier-test' }).first()
    assert.equal(row.data.value, -7, '-3 + min(perTurn(2) × 2 crans, cap 5) = -3 - 4')

    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:decomposant-modifier-test', { ...opts, currentTurn: 4 })
    row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:decomposant-modifier-test' }).first()
    assert.equal(row.data.value, -8, '-3 + min(perTurn(2) × 3 crans, cap 5) = -3 - 5 : cap atteint')
  } finally {
    await cleanup(fx)
  }
})

test('applyZoneModifier — changement de zoneInstanceId : escalationStacks repart de 0 (jamais hérité d\'une autre zone)', { skip }, async () => {
  const fx = await createFixture()
  try {
    const base = { target: 'actions', value: -3, escalation: { perTurn: 2, cap: null }, remanence: 'decay', remanenceParams: { perTurn: 1 } }
    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:test-reset', { ...base, zoneInstanceId: 'zone-A', currentTurn: 1 })
    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:test-reset', { ...base, zoneInstanceId: 'zone-A', currentTurn: 2 })
    let row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:test-reset' }).first()
    assert.equal(row.data.escalationStacks, 1)

    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:test-reset', { ...base, zoneInstanceId: 'zone-B', currentTurn: 3 })
    row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:test-reset' }).first()
    assert.equal(row.data.escalationStacks, 0, 'nouvelle zoneInstanceId : jamais un cumul hérité de zone-A')
  } finally {
    await cleanup(fx)
  }
})

test('clearZoneModifier — retrait direct, jamais via clearHazard/findHazardRegistryEntry', { skip }, async () => {
  const fx = await createFixture()
  try {
    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:irritant', {
      zoneInstanceId: 'zone-1', target: 'actions', value: -3, escalation: null,
      remanence: 'none', remanenceParams: {}, currentTurn: 1,
    })
    await clearZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:irritant')
    const row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:irritant' }).first()
    assert.equal(row, undefined)
  } finally {
    await cleanup(fx)
  }
})

test('resolveZoneModifierTicks — decay : décroît de remanenceParams.perTurn/Tour, se retire à 0, ignore une ligne rafraîchie ce Tour', { skip }, async () => {
  const fx = await createFixture()
  try {
    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:irritant', {
      zoneInstanceId: 'zone-1', target: 'actions', value: -3, escalation: null,
      remanence: 'decay', remanenceParams: { perTurn: 1 }, currentTurn: 5,
    })
    const rowAtTurn5 = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:irritant' }).first()

    // Même Tour que le dernier rafraîchissement (le token est encore dans sa zone) : rien à faire.
    await resolveZoneModifierTicks(fakeIo, db, fx.campaign.id, 5, [
      { token_id: fx.token.id, status_code: 'gaz:irritant', data: rowAtTurn5.data },
    ])
    let row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:irritant' }).first()
    assert.equal(row.data.value, -3, 'lastRefreshedTurn === currentTurn : encore dans sa zone, aucune décroissance')

    // Tour suivant, le token est sorti (plus rafraîchi) : décroissance d'1 cran.
    await resolveZoneModifierTicks(fakeIo, db, fx.campaign.id, 6, [
      { token_id: fx.token.id, status_code: 'gaz:irritant', data: row.data },
    ])
    row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:irritant' }).first()
    assert.equal(row.data.value, -2)

    await resolveZoneModifierTicks(fakeIo, db, fx.campaign.id, 7, [
      { token_id: fx.token.id, status_code: 'gaz:irritant', data: row.data },
    ])
    row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:irritant' }).first()
    assert.equal(row.data.value, -1)

    await resolveZoneModifierTicks(fakeIo, db, fx.campaign.id, 8, [
      { token_id: fx.token.id, status_code: 'gaz:irritant', data: row.data },
    ])
    row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:irritant' }).first()
    assert.equal(row, undefined, 'magnitude tombée à 0 : la ligne est retirée')
  } finally {
    await cleanup(fx)
  }
})

test('resolveZoneModifierTicks — remanence \'none\' : jamais touché ici (déjà nettoyé par sweepZoneExposure)', { skip }, async () => {
  const fx = await createFixture()
  try {
    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:irritant', {
      zoneInstanceId: 'zone-1', target: 'actions', value: -3, escalation: null,
      remanence: 'none', remanenceParams: {}, currentTurn: 1,
    })
    const row = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:irritant' }).first()
    await resolveZoneModifierTicks(fakeIo, db, fx.campaign.id, 2, [
      { token_id: fx.token.id, status_code: 'gaz:irritant', data: row.data },
    ])
    const after = await db('token_statuses').where({ token_id: fx.token.id, status_code: 'gaz:irritant' }).first()
    assert.equal(after.data.value, -3, 'remanence !== decay : cette boucle ne le touche pas')
  } finally {
    await cleanup(fx)
  }
})

test('resolveZoneModifierMalus — somme les target:\'actions\' des tokens actifs du personnage, ignore les autres targets', { skip }, async () => {
  const fx = await createFixture()
  try {
    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'gaz:irritant', {
      zoneInstanceId: 'zone-1', target: 'actions', value: -3, escalation: null,
      remanence: 'decay', remanenceParams: { perTurn: 1 }, currentTurn: 1,
    })
    await applyZoneModifier(fakeIo, db, fx.campaign.id, fx.token.id, 'zone:autre-target', {
      zoneInstanceId: 'zone-2', target: 'defense', value: -10, escalation: null,
      remanence: 'decay', remanenceParams: { perTurn: 1 }, currentTurn: 1,
    })
    const malus = await resolveZoneModifierMalus(db, fx.campaign.id, fx.character.id)
    assert.equal(malus, -3, 'target:\'defense\' hors périmètre du malus de Test générique')
  } finally {
    await cleanup(fx)
  }
})

test('resolveZoneModifierMalus — personnage sans token actif : 0, jamais un throw', { skip }, async () => {
  const fx = await createFixture()
  try {
    await db('tokens').where({ id: fx.token.id }).del()
    const malus = await resolveZoneModifierMalus(db, fx.campaign.id, fx.character.id)
    assert.equal(malus, 0)
    fx.token = { id: null }
  } finally {
    if (fx.token.id) await cleanup(fx)
    else {
      await db('characters').where({ id: fx.character.id }).del()
      await db('battlemaps').where({ campaign_id: fx.campaign.id }).del()
      await db('campaigns').where({ id: fx.campaign.id }).del()
      await db('users').where({ id: fx.gm.id }).del()
    }
  }
})
