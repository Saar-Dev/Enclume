import test from 'node:test'
import assert from 'node:assert/strict'

import { aggregateTraitGauges, applyFractionalLoss } from './traitAggregation.js'

test('applyFractionalLoss — un quart en moins, arrondi polarisRound (0.5 vers le bas)', () => {
  assert.equal(applyFractionalLoss(4, [-0.25]), 3) // -1 pile
  assert.equal(applyFractionalLoss(3, [-0.25]), 2) // -0.75 -> polarisRound(-0.75) = -1
  assert.equal(applyFractionalLoss(2, [-0.5]), 1)
  assert.equal(applyFractionalLoss(0, [-0.25]), 0)
})

test('applyFractionalLoss — plusieurs fractions independantes, jamais en cascade', () => {
  // Deux Revers "-1/4" sur la meme base 4 : chacun retire 1 (contre 4), pas 1 puis 0.75 contre 3.
  assert.equal(applyFractionalLoss(4, [-0.25, -0.25]), 2)
})

test('aggregateTraitGauges — gauge_delta simple (Deuil -1 Allie, Ennemi +1)', () => {
  const { gauges } = aggregateTraitGauges([
    { trait_type: 'ally', op: 'gauge_delta', value: 2 },
    { trait_type: 'ally', op: 'gauge_delta', value: -1 },
    { trait_type: 'enemy', op: 'gauge_delta', value: 1 },
  ])
  assert.deepEqual(gauges, { ally: 1, enemy: 1 })
})

test('aggregateTraitGauges — gauge_set ecrase, note conservee', () => {
  const { gauges, notes } = aggregateTraitGauges([
    { trait_type: 'employer', op: 'gauge_set', value: 0, note: 'Compagnie du Trident' },
  ])
  assert.deepEqual(gauges, { employer: 0 })
  assert.equal(notes.employer, 'Compagnie du Trident')
})

test('aggregateTraitGauges — Diffamation reelle : -1/4 Allies (base 4 -> 3), -1/2 Contacts (base 3 -> 1 apres arrondi)', () => {
  const { gauges } = aggregateTraitGauges([
    { trait_type: 'ally', op: 'gauge_delta', value: 4 },
    { trait_type: 'contact', op: 'gauge_delta', value: 3 },
    { trait_type: 'ally', op: 'gauge_fraction_delta', value: -0.25 },
    { trait_type: 'contact', op: 'gauge_fraction_delta', value: -0.5 },
  ])
  assert.deepEqual(gauges, { ally: 3, contact: 1 })
})

test('aggregateTraitGauges — deux notes distinctes sur le meme trait_type (Ennemi important + Vendetta) sont conservees toutes les deux', () => {
  const { gauges, notes } = aggregateTraitGauges([
    { trait_type: 'enemy', op: 'gauge_delta', value: 1, note: 'important' },
    { trait_type: 'enemy', op: 'gauge_delta', value: 1, note: 'vendetta' },
  ])
  assert.deepEqual(gauges, { enemy: 2 })
  assert.equal(notes.enemy, 'important, vendetta')
})

test('aggregateTraitGauges — fraction sur trait_type absent (base 0) ne casse rien', () => {
  const { gauges } = aggregateTraitGauges([
    { trait_type: 'ally', op: 'gauge_fraction_delta', value: -0.25 },
  ])
  assert.deepEqual(gauges, { ally: 0 })
})
