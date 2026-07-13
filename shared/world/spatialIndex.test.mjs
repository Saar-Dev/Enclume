import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorldSnapshot } from './worldContracts.js'
import {
  actorBoundsAt,
  createOccupancyIndex,
  createSpatialIndex,
} from './spatialIndex.js'

function snapshotWithWall() {
  const wallBounds = {
    min: { x: 1.9, y: 0, z: 0 },
    max: { x: 2.1, y: 2.5, z: 1 },
  }
  return createWorldSnapshot({
    spatial: {
      supports: [], barriers: [], traversals: [], occluders: [], compartments: [], regions: [],
      colliders: [{ id: 'wall', sourceId: 'wall', kind: 'wall', bounds: wallBounds }],
    },
  })
}

test('l’index statique détecte un mur sans traiter le sol touché comme un obstacle', () => {
  const snapshot = snapshotWithWall()
  const index = createSpatialIndex(snapshot)
  assert.equal(index.isSegmentClear(
    { x: 0.5, y: 0.125, z: 0.5 },
    { x: 2.5, y: 0.125, z: 0.5 },
  ), false)

  const floorSnapshot = createWorldSnapshot({
    spatial: {
      supports: [], barriers: [], traversals: [], occluders: [], compartments: [], regions: [],
      colliders: [{
        id: 'floor', sourceId: 'floor', kind: 'floor',
        bounds: { min: { x: 0, y: -0.125, z: 0 }, max: { x: 2, y: 0.125, z: 1 } },
      }],
    },
  })
  assert.equal(createSpatialIndex(floorSnapshot).isSegmentClear(
    { x: 0.5, y: 0.125, z: 0.5 },
    { x: 1.5, y: 0.125, z: 0.5 },
  ), true)
})

test('l’occupation dynamique conserve plusieurs occupants dans un même volume', () => {
  const occupants = createOccupancyIndex([
    { id: 'token-a', point: { x: 1, y: 0, z: 1 } },
    { id: 'token-b', point: { x: 1, y: 0, z: 1 } },
  ])
  const bounds = actorBoundsAt({ x: 1, y: 0, z: 1 })

  assert.deepEqual(occupants.queryBounds(bounds).map(item => item.id), ['token-a', 'token-b'])
  assert.equal(occupants.canOccupy({ x: 1, y: 0, z: 1 }, {}, { excludeIds: ['token-a'] }), false)
  assert.equal(occupants.canOccupy(
    { x: 1, y: 0, z: 1 },
    {},
    { excludeIds: ['token-a', 'token-b'] },
  ), true)
})

test('un collider incliné utilise son prisme orienté et non toute sa boîte englobante', () => {
  const geometry = {
    type: 'wall-segment',
    from: { x: 0, z: 0 },
    to: { x: 1, z: 1 },
    minY: 0,
    maxY: 2.5,
    thickness: 0.1,
  }
  const diagonal = createWorldSnapshot({
    spatial: {
      supports: [], barriers: [], traversals: [], occluders: [], compartments: [], regions: [],
      colliders: [{
        id: 'diagonal', sourceId: 'diagonal', kind: 'wall', geometry,
        bounds: { min: { x: -0.05, y: 0, z: -0.05 }, max: { x: 1.05, y: 2.5, z: 1.05 } },
      }],
    },
  })
  const index = createSpatialIndex(diagonal)
  const actor = { radius: 0.05, height: 1.8, maxStepHeight: 0.5 }

  assert.equal(index.isSegmentClear({ x: 0.1, y: 0, z: 0.9 }, { x: 0.2, y: 0, z: 0.9 }, actor), true)
  assert.equal(index.isSegmentClear({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, actor), false)
})
