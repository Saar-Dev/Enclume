import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { buildBroadcastRoster } from './combatRosterBroadcast.js'
import { setCharacterState } from './characterStateService.js'

// Lancement manuel : node --env-file=../.env --test server/src/lib/combatRosterBroadcast.test.mjs
// Patron rollback (154_world_effects_runtime.test.mjs) : rien n'est jamais persisté.

async function createFixtureTokens(trx, n) {
  const [user] = await trx('users')
    .insert({ email: `roster-broadcast-test-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'roster-broadcast-test' })
    .returning('*')
  const [campaign] = await trx('campaigns')
    .insert({ gm_id: user.id, name: 'Campagne test broadcast', invite_code: `RB-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [battlemap] = await trx('battlemaps')
    .insert({ campaign_id: campaign.id, name: 'Battlemap test broadcast' })
    .returning('*')
  const tokens = await trx('tokens')
    .insert(Array.from({ length: n }, (_, i) => ({ battlemap_id: battlemap.id, label: `token-${i}` })))
    .returning('*')
  return tokens
}

test('retire surprise_roll, préserve les autres champs, et source position/weapon depuis character_states', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const [tokenA, tokenB] = await createFixtureTokens(trx, 2)
    await setCharacterState(trx, tokenA.id, 'position', 'kneeling')
    await setCharacterState(trx, tokenA.id, 'weapon', 'drawn')
    // tokenB : aucune ligne character_states -> défauts attendus

    const rows = [
      { id: 'row-a', token_id: tokenA.id, surprise_roll: 14, state_position: 'standing', state_weapon: 'holstered', initiative: 5 },
      { id: 'row-b', token_id: tokenB.id, surprise_roll: null, state_position: 'standing', state_weapon: 'holstered', initiative: 3 },
    ]
    const result = await buildBroadcastRoster(trx, rows)

    assert.equal(result.length, 2)
    for (const row of result) assert.equal('surprise_roll' in row, false)

    // tokenA : character_states (kneeling/drawn) prime sur les colonnes combat_roster passées en entrée (standing/holstered)
    assert.deepEqual(result[0], { id: 'row-a', token_id: tokenA.id, state_position: 'kneeling', state_weapon: 'drawn', initiative: 5 })
    // tokenB : pas de ligne character_states -> défauts (standing/holstered)
    assert.deepEqual(result[1], { id: 'row-b', token_id: tokenB.id, state_position: 'standing', state_weapon: 'holstered', initiative: 3 })

    throw new Error('ROLLBACK_TEST')
  }), /ROLLBACK_TEST/)
})

test('tableau vide -> tableau vide, sans requête character_states', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const result = await buildBroadcastRoster(db, [])
  assert.deepEqual(result, [])
})

test.after(async () => { await db.destroy() })
