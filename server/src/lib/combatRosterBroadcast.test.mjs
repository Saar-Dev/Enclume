import test from 'node:test'
import assert from 'node:assert/strict'

import { buildBroadcastRoster } from './combatRosterBroadcast.js'

// Lancement manuel : node --test server/src/lib/combatRosterBroadcast.test.mjs
// Fonction pure — aucune fixture DB nécessaire.

test('retire surprise_roll et préserve tous les autres champs', () => {
  const rows = [
    { id: 'a', token_id: 't1', surprise_roll: 14, state_position: 'crouching', initiative: 5 },
    { id: 'b', token_id: 't2', surprise_roll: null, state_position: 'standing', initiative: 3 },
  ]
  const result = buildBroadcastRoster(rows)

  assert.equal(result.length, 2)
  for (const row of result) assert.equal('surprise_roll' in row, false)
  assert.deepEqual(result[0], { id: 'a', token_id: 't1', state_position: 'crouching', initiative: 5 })
  assert.deepEqual(result[1], { id: 'b', token_id: 't2', state_position: 'standing', initiative: 3 })
})

test('ne mute pas le tableau/les objets source', () => {
  const rows = [{ id: 'a', surprise_roll: 14 }]
  buildBroadcastRoster(rows)
  assert.equal(rows[0].surprise_roll, 14)
})

test('tableau vide -> tableau vide', () => {
  assert.deepEqual(buildBroadcastRoster([]), [])
})
