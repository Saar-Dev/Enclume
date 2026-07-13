import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMovementPlan,
  calculateMovementCost,
  createPathSegment,
} from './movementCost.js'

test('les catégories de facteur se multiplient et restent explicables', () => {
  const result = calculateMovementCost(3, {
    traversal: { code: 'climb', value: 2 },
    surface: 1,
    environment: [{ code: 'slippery', value: 2 }],
    actor: [{ code: 'injured-arm', value: 1.5 }],
  })
  assert.equal(result.factor, 6)
  assert.equal(result.costM, 18)
  assert.equal(result.factors.environment[0].code, 'slippery')
})

test('scénario doré Jon : 3 m au sol puis 3 m sur une échelle coûtent 15 m', () => {
  const ground = createPathSegment({
    id: 'ground',
    from: { x: 0, y: 0, z: 0 },
    to: { x: 2, y: 0, z: 0 },
    mode: 'walk',
  })
  const ladder = createPathSegment({
    id: 'ladder',
    from: ground.to,
    to: { x: 2, y: 5, z: 0 },
    mode: 'climb',
    factors: {
      traversal: { code: 'climb', value: 2 },
      environment: [{ code: 'slippery-rungs', value: 2 }],
    },
  })

  const plan = buildMovementPlan({ segments: [ground, ladder], budgetM: 15, worldRevision: 7 })

  assert.equal(plan.spentM, 15)
  assert.equal(plan.distanceM, 6)
  assert.equal(plan.reachedDestination, false)
  assert.equal(plan.stopReason, 'budget')
  assert.equal(plan.segments.length, 2)
  assert.equal(plan.segments[1].partial, true)
  assert.equal(plan.segments[1].distanceM, 3)
  assert.deepEqual(plan.end, { x: 2, y: 2, z: 0 })
})

test('un trajet non fractionnable attend avant l’ascenseur', () => {
  const elevator = createPathSegment({
    id: 'elevator-trip',
    from: { x: 0, y: 0, z: 0 },
    to: { x: 0, y: 2.5, z: 0 },
    mode: 'elevator',
    distanceM: 10,
    allowPartial: false,
  })
  const plan = buildMovementPlan({ segments: [elevator], budgetM: 9 })
  assert.equal(plan.spentM, 0)
  assert.deepEqual(plan.end, { x: 0, y: 0, z: 0 })
  assert.equal(plan.stopReason, 'non_partial_segment')
})

test('un facteur nul ou négatif est refusé', () => {
  assert.throws(() => calculateMovementCost(3, { surface: 0 }), /strictement positif/)
  assert.throws(() => calculateMovementCost(3, { effects: [-1] }), /strictement positif/)
})
