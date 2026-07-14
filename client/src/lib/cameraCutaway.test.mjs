import test from 'node:test'
import assert from 'node:assert/strict'

import {
  evenlySampleTargets,
  segmentIntersectionRatio2D,
  wallSliceOccludesFloorTargets,
} from './cameraCutaway.js'

test('une intersection 2D conserve la position du mur sur le rayon caméra-sol', () => {
  assert.equal(segmentIntersectionRatio2D(
    { x: -4, z: 0 },
    { x: 4, z: 0 },
    { x: 0, z: -2 },
    { x: 0, z: 2 },
  ), 0.5)
})

test('seule la tranche verticale traversée entre la caméra et le sol devient transparente', () => {
  const input = {
    camera: { x: -4, y: 7.5, z: 0 },
    wallPath: [{ x: 0, z: -2 }, { x: 0, z: 2 }],
    targets: [{ x: 4, y: 0, z: 0, roomId: 'tower' }],
    wallRoomIds: ['tower'],
  }
  assert.equal(wallSliceOccludesFloorTargets({ ...input, wallBottom: 2.5, wallTop: 5 }), true)
  assert.equal(wallSliceOccludesFloorTargets({ ...input, wallBottom: 0, wallTop: 2.5 }), false)
  assert.equal(wallSliceOccludesFloorTargets({ ...input, wallBottom: 5, wallTop: 7.5 }), false)
})

test('un mur arrière ou appartenant à une autre salle reste opaque', () => {
  const common = {
    camera: { x: -4, y: 7.5, z: 0 },
    targets: [{ x: 4, y: 0, z: 0, roomId: 'tower' }],
    wallBottom: 2.5,
    wallTop: 5,
  }
  assert.equal(wallSliceOccludesFloorTargets({
    ...common,
    wallPath: [{ x: 6, z: -2 }, { x: 6, z: 2 }],
    wallRoomIds: ['tower'],
  }), false)
  assert.equal(wallSliceOccludesFloorTargets({
    ...common,
    wallPath: [{ x: 0, z: -2 }, { x: 0, z: 2 }],
    wallRoomIds: ['other-room'],
  }), false)
})

test('l échantillonnage des grands sols reste borné et réparti', () => {
  const targets = Array.from({ length: 1000 }, (_, index) => ({ x: index }))
  const sampled = evenlySampleTargets(targets, 100)
  assert.equal(sampled.length, 100)
  assert.equal(sampled[0].x, 0)
  assert.equal(sampled.at(-1).x, 990)
})
