import test from 'node:test'
import assert from 'node:assert/strict'

import {
  elevatorBoardingPoint,
  elevatorLocalPosition,
  findCabinSupportForPoint,
} from './worldElevatorService.js'
import { elevatorPassengerWorldPoint, normalizeElevatorDefinition } from '../../../shared/world/elevatorRuntime.js'

const definition = normalizeElevatorDefinition({
  id: 'cabine-test', x: 2, z: 4, fromLevel: 0, toLevel: 2,
})

test('un support de cabine ne capture que les pieds posés sur son plancher', () => {
  const support = {
    kind: 'elevator-cabin', sourceId: definition.id, y: 2.5,
    bounds: { min: { x: 2, y: 2.38, z: 4 }, max: { x: 3, y: 2.5, z: 5 } },
  }
  const snapshot = { spatial: { supports: [support] } }
  assert.equal(findCabinSupportForPoint(snapshot, { x: 2.5, y: 2.5, z: 4.5 }), support)
  assert.equal(findCabinSupportForPoint(snapshot, { x: 2.5, y: 2.6, z: 4.5 }), null)
})

test('la conversion monde/local est réversible dans le repère de la cabine', () => {
  const state = { positionY: 5.125 }
  const world = { x: 2.35, y: 5.125, z: 4.8 }
  const local = elevatorLocalPosition(definition, state, world)
  assert.deepEqual(elevatorPassengerWorldPoint(definition, state, local), world)
})

test('le point d’embarquement place le token au centre du plancher mobile', () => {
  const state = { positionX: 7, positionY: 5.125, positionZ: -2 }
  const wideDefinition = { ...definition, width: 2, depth: 1 }
  const point = elevatorBoardingPoint(wideDefinition, state)
  assert.deepEqual(point, { x: 8, y: 5.125, z: -1.5 })
  assert.deepEqual(elevatorLocalPosition(wideDefinition, state, point), { x: 1, y: 0, z: 0.5 })
})
