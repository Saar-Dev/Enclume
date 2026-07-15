import test from 'node:test'
import assert from 'node:assert/strict'

import { dynamicOccupantsFromRows, resolvePlacementPoint } from './worldMovementService.js'

test('l’occupation dynamique serveur conserve les axes PE14 et les occupants multiples', () => {
  const occupants = dynamicOccupantsFromRows([
    { id: 'token-a', pos_x: 2, pos_y: 3, pos_z: 4, layer: 'token', position_space: 'world-feet' },
    { id: 'token-b', pos_x: 2, pos_y: 3, pos_z: 4, layer: 'token', position_space: 'world-feet' },
    { id: 'gm-marker', pos_x: 2, pos_y: 3, pos_z: 4, layer: 'gm', position_space: 'world-feet' },
  ], [])
  assert.deepEqual(occupants.map(item => item.id), ['token-a', 'token-b'])
  assert.deepEqual(occupants[0].point, { x: 2, y: 4, z: 3 })
})

test('une entité non bloquante est absente de l’occupation physique', () => {
  const occupants = dynamicOccupantsFromRows([], [
    {
      id: 'open-door', pos_x: 0, pos_y: 0, pos_z: 0, current_state_id: 0,
      states: [{ is_blocking: false }],
    },
    {
      id: 'crate', pos_x: 1, pos_y: 0, pos_z: 0, current_state_id: 0,
      states: [{ is_blocking: true, collider: { width: 2, depth: 1, height: 1 } }],
    },
  ])
  assert.deepEqual(occupants.map(item => item.id), ['crate'])
  assert.equal(occupants[0].actorProfile.radius, 1)
})

test('la création d’un token se cale sur un support stable libre', () => {
  const graph = {
    actorProfile: { radius: 0.35, height: 1.8, maxStepHeight: 0.5 },
    nodes: [
      { id: 'traversal', kind: 'traversal', stable: true, point: { x: 0, y: 0, z: 0 } },
      { id: 'floor', kind: 'support', stable: true, point: { x: 0.5, y: 0.125, z: 0.5 } },
    ],
  }
  assert.deepEqual(
    resolvePlacementPoint({ graph, destination: { x: 0, y: 0, z: 0 } }),
    { x: 0.5, y: 0.125, z: 0.5 },
  )
  assert.equal(resolvePlacementPoint({
    graph,
    destination: { x: 0, y: 0, z: 0 },
    occupants: [{
      id: 'already-there',
      point: { x: 0.5, y: 0.125, z: 0.5 },
      actorProfile: graph.actorProfile,
    }],
  }), null)
})

test('l échelle d instance agrandit aussi son occupation physique', () => {
  const [occupant] = dynamicOccupantsFromRows([], [{
    id: 'scaled-crate', pos_x: 0, pos_y: 0, pos_z: 0, current_state_id: 0,
    state: { transform: { scale: 1.5 } },
    geometry: { width: 2, depth: 1, height: 2 },
    states: [{ is_blocking: true }],
  }])
  assert.equal(occupant.actorProfile.radius, 1.5)
  assert.equal(occupant.actorProfile.height, 3)
})

test('une création administrative ne place pas un token non attaché dans une cabine mobile', () => {
  const graph = {
    actorProfile: { radius: 0.35, height: 1.8, maxStepHeight: 0.5 },
    nodes: [
      { id: 'cabin', kind: 'support', stable: true, mobile: true, point: { x: 0.5, y: 0.125, z: 0.5 } },
      { id: 'floor', kind: 'support', stable: true, point: { x: 1.5, y: 0.125, z: 0.5 } },
    ],
  }
  assert.deepEqual(
    resolvePlacementPoint({ graph, destination: { x: 0.55, y: 0.125, z: 0.5 } }),
    { x: 1.5, y: 0.125, z: 0.5 },
  )
})
