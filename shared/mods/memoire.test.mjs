import test from 'node:test'
import assert from 'node:assert/strict'

import { memoireOnBeforeAttack } from './memoire.js'

const rollDice = (total) => async () => ({ total, rolls: [total], seed: total })

test('aucune cible enregistrée (pas d’UI Phase 4) -> jamais bloqué, aucun jet', async () => {
  let rolled = false
  const result = await memoireOnBeforeAttack(null, {
    targetCharacterId: 'char-B', modLevel: 15, rollDice: async (f) => { rolled = true; return rollDice(1)(f) },
  })
  assert.deepEqual(result, { blocked: false })
  assert.equal(rolled, false)
})

test('cible préenregistrée, mais pas la cible visée -> jamais bloqué, aucun jet', async () => {
  const modState = { memoire: { registeredTargetIds: ['char-AMI'] } }
  const result = await memoireOnBeforeAttack(modState, { targetCharacterId: 'char-ENNEMI', modLevel: 15, rollDice: rollDice(1) })
  assert.deepEqual(result, { blocked: false })
})

test('cible préenregistrée + Test réussi -> reconnaissance, tir bloqué (RAW EQ_00002)', async () => {
  const modState = { memoire: { registeredTargetIds: ['char-AMI'] } }
  // modLevel 15, roll 10 -> réussite
  const result = await memoireOnBeforeAttack(modState, { targetCharacterId: 'char-AMI', modLevel: 15, rollDice: rollDice(10) })
  assert.equal(result.blocked, true)
})

test('cible préenregistrée + Test raté -> système en panne, ne reconnaît pas, tir normal', async () => {
  const modState = { memoire: { registeredTargetIds: ['char-AMI'] } }
  // modLevel 15, roll 18 -> échec
  const result = await memoireOnBeforeAttack(modState, { targetCharacterId: 'char-AMI', modLevel: 15, rollDice: rollDice(18) })
  assert.deepEqual(result, { blocked: false })
})
