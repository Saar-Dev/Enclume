import test from 'node:test'
import assert from 'node:assert/strict'

import { projecteurOnBeforeAttack } from './projecteur.js'

const rollDice = (total) => async () => ({ total, rolls: [total], seed: total })

test('pas un Tir visé -> jamais bloqué, aucun jet (RAW : "doit effectuer un Tir visé")', async () => {
  const result = await projecteurOnBeforeAttack(null, { isAimedShot: false, targetIsMoving: true, targetMovementMalus: -5, modLevel: 10, rollDice: rollDice(1) })
  assert.deepEqual(result, { blocked: false })
})

test('cible immobile -> jamais bloqué, aucun jet', async () => {
  const result = await projecteurOnBeforeAttack(null, { isAimedShot: true, targetIsMoving: false, targetMovementMalus: 0, modLevel: 10, rollDice: rollDice(1) })
  assert.deepEqual(result, { blocked: false })
})

test('cible en mouvement mais malus nul -> rien à réduire, pas de jet', async () => {
  const result = await projecteurOnBeforeAttack(null, { isAimedShot: true, targetIsMoving: true, targetMovementMalus: 0, modLevel: 10, rollDice: rollDice(1) })
  assert.deepEqual(result, { blocked: false })
})

test('Test raté -> tir automatiquement raté (RAW EQ_00005)', async () => {
  // modLevel 10, roll 15 -> échec
  const result = await projecteurOnBeforeAttack(null, {
    isAimedShot: true, targetIsMoving: true, targetMovementMalus: -5, modLevel: 10, rollDice: rollDice(15),
  })
  assert.equal(result.blocked, true)
})

test('Test réussi, marge < malus -> réduit le malus de la marge exacte', async () => {
  // modLevel 10, roll 7 -> marge 3, malus -5 -> réduction 3 (reste -2 net, calculé côté appelant)
  const result = await projecteurOnBeforeAttack(null, {
    isAimedShot: true, targetIsMoving: true, targetMovementMalus: -5, modLevel: 10, rollDice: rollDice(7),
  })
  assert.equal(result.blocked, false)
  assert.deepEqual(result.adjustedModifiers, { targetMovementMalusReduction: 3 })
})

test('Test réussi, marge > malus -> plafonné, jamais de bonus résiduel (RAW explicite)', async () => {
  // modLevel 10, roll 2 -> marge 8, malus seulement -3 -> réduction plafonnée à 3, pas 8
  const result = await projecteurOnBeforeAttack(null, {
    isAimedShot: true, targetIsMoving: true, targetMovementMalus: -3, modLevel: 10, rollDice: rollDice(2),
  })
  assert.deepEqual(result.adjustedModifiers, { targetMovementMalusReduction: 3 })
})

test('cible en zigzag -> niveau de l’appareil réduit de moitié avant le Test (RAW)', async () => {
  // modLevel 10 -> effectif 5 (zigzag). roll 6 > 5 -> échec (alors que 6 <= 10 aurait réussi sans zigzag)
  const result = await projecteurOnBeforeAttack(null, {
    isAimedShot: true, targetIsMoving: true, targetMovementIsErratic: true, targetMovementMalus: -5,
    modLevel: 10, rollDice: rollDice(6),
  })
  assert.equal(result.blocked, true)
})
