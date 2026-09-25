import test from 'node:test'
import assert from 'node:assert/strict'
import { CHC_FLOOR, CHC_CEIL, canSpendChance } from './chanceRules.js'

test('plancher et plafond de la Chance (RAW : on ne dépense plus à 3)', () => {
  assert.equal(CHC_FLOOR, 3)
  assert.equal(CHC_CEIL, 20)
})

test('canSpendChance — il doit rester au moins 3 points : seuils exacts et juste au-dessous', () => {
  assert.equal(canSpendChance(6, 3), true, '6 − 3 = 3 : autorisé')
  assert.equal(canSpendChance(5, 3), false, '5 − 3 = 2 : refusé')
  assert.equal(canSpendChance(4, 1), true)
  assert.equal(canSpendChance(3, 1), false, 'déjà au plancher')
  assert.equal(canSpendChance(11, 2), true)
  assert.equal(canSpendChance(20, 17), true)
  assert.equal(canSpendChance(20, 18), false)
})

test('canSpendChance — valeurs absentes ou invalides : jamais dépensable', () => {
  assert.equal(canSpendChance(null, 1), false)
  assert.equal(canSpendChance(undefined, 1), false)
  assert.equal(canSpendChance(NaN, 1), false)
  assert.equal(canSpendChance(10, undefined), false)
})
