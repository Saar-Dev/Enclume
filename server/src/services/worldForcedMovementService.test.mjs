import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorldSnapshot } from '../../../shared/world/worldContracts.js'
import { resolveRigidPairSteps } from './worldForcedMovementService.js'

const points = [-0.5, 0.5, 1.5, 2.5]
const supports = points.map((x, index) => ({
  id: `support:${index}`,
  kind: 'floor',
  bounds: { min: { x: x - 0.5, y: -0.1, z: 0 }, max: { x: x + 0.5, y: 0, z: 1 } },
  y: 0,
  walkable: true,
}))
const snapshot = createWorldSnapshot({
  battlemapId: 'battlemap',
  worldRevision: 1,
  metrics: { metersPerCell: 1.5, worldUnitsPerCell: 1, storyHeightWorld: 2.5 },
  spatial: { supports, colliders: [], occluders: [], traversals: [], regions: [], compartments: [] },
})
const graph = {
  nodes: points.map((x, index) => ({ id: `node:${index}`, kind: 'support', stable: true, point: { x, y: 0, z: 0.5 } })),
}

test('deplace le token et l objet comme une paire rigide sur les supports du monde', () => {
  const result = resolveRigidPairSteps({
    snapshot,
    graph,
    actorStart: { x: -0.5, y: 0, z: 0.5 },
    entityStart: { x: 0.5, y: 0, z: 0.5 },
    destination: { x: 2.5, y: 0, z: 0.5 },
    maxSteps: 2,
    occupants: [],
    excludeOccupantIds: ['actor', 'entity'],
  })
  assert.equal(result.status, 'destination')
  assert.equal(result.stepsCompleted, 2)
  assert.deepEqual(result.actorEnd, { x: 1.5, y: 0, z: 0.5 })
  assert.deepEqual(result.entityEnd, { x: 2.5, y: 0, z: 0.5 })
})

test('s arrete au dernier support libre sans traverser un occupant', () => {
  const result = resolveRigidPairSteps({
    snapshot,
    graph,
    actorStart: { x: -0.5, y: 0, z: 0.5 },
    entityStart: { x: 0.5, y: 0, z: 0.5 },
    destination: { x: 2.5, y: 0, z: 0.5 },
    maxSteps: 2,
    occupants: [{ id: 'blocker', point: { x: 2.5, y: 0, z: 0.5 }, actorProfile: {} }],
    excludeOccupantIds: ['actor', 'entity'],
  })
  assert.equal(result.status, 'blocked')
  assert.equal(result.stepsCompleted, 1)
  assert.deepEqual(result.entityEnd, { x: 1.5, y: 0, z: 0.5 })
})
