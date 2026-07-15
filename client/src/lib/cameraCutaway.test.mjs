import test from 'node:test'
import assert from 'node:assert/strict'

import {
  evenlySampleTargets,
  nearestOccludingFacadeIds,
  segmentIntersectionRatio2D,
  wallFacadeKey,
} from './cameraCutaway.js'

test('une intersection 2D conserve la position du mur sur le rayon caméra-sol', () => {
  assert.equal(segmentIntersectionRatio2D(
    { x: -4, z: 0 },
    { x: 4, z: 0 },
    { x: 0, z: -2 },
    { x: 0, z: 2 },
  ), 0.5)
})

function rectangularFacades() {
  return [
    { id: 'front', surfaces: [{ roomIds: ['tower'], path: [{ x: 0, z: 0 }, { x: 4, z: 0 }] }] },
    { id: 'right', surfaces: [{ roomIds: ['tower'], path: [{ x: 4, z: 0 }, { x: 4, z: 4 }] }] },
    { id: 'back', surfaces: [{ roomIds: ['tower'], path: [{ x: 4, z: 4 }, { x: 0, z: 4 }] }] },
    { id: 'left', surfaces: [{ roomIds: ['tower'], path: [{ x: 0, z: 4 }, { x: 0, z: 0 }] }] },
  ]
}

test('une vue de face masque la façade avant complète mais jamais le mur du fond', () => {
  const result = nearestOccludingFacadeIds({
    camera: { x: 2, z: -6 },
    targets: [
      { x: 0.5, z: 0.5, roomId: 'tower' },
      { x: 2, z: 2, roomId: 'tower' },
      { x: 3.5, z: 3.5, roomId: 'tower' },
    ],
    facades: rectangularFacades(),
  })
  assert.deepEqual([...result], ['front'])
})

test('une vue en diagonale masque seulement les deux façades les plus proches', () => {
  const result = nearestOccludingFacadeIds({
    camera: { x: -6, z: -6 },
    targets: [
      { x: 0.5, z: 3.5, roomId: 'tower' },
      { x: 3.5, z: 0.5, roomId: 'tower' },
      { x: 3.5, z: 3.5, roomId: 'tower' },
    ],
    facades: rectangularFacades(),
  })
  assert.deepEqual([...result].sort(), ['front', 'left'])
  assert.equal(result.has('back'), false)
  assert.equal(result.has('right'), false)
})

test('les tranches et découpes d une façade partagent une seule décision', () => {
  const facade = {
    id: 'front',
    surfaces: [
      { roomIds: ['tower'], path: [{ x: 0, z: 0 }, { x: 1.5, z: 0 }] },
      { roomIds: ['tower'], path: [{ x: 2.5, z: 0 }, { x: 4, z: 0 }] },
      { roomIds: ['tower'], path: [{ x: 0, z: 0 }, { x: 4, z: 0 }] },
    ],
  }
  const result = nearestOccludingFacadeIds({
    camera: { x: 2, z: -6 },
    targets: [{ x: 2, z: 3, roomId: 'tower' }],
    facades: [facade, rectangularFacades()[2]],
  })
  assert.deepEqual([...result], ['front'])
  assert.equal(wallFacadeKey({ facadeId: 'front', logicalWallId: 'slice:0' }), 'front')
  assert.equal(wallFacadeKey({ facadeId: 'front', logicalWallId: 'slice:1' }), 'front')
})

test('l échantillonnage des grands sols reste borné et réparti', () => {
  const targets = Array.from({ length: 1000 }, (_, index) => ({ x: index }))
  const sampled = evenlySampleTargets(targets, 100)
  assert.equal(sampled.length, 100)
  assert.equal(sampled[0].x, 0)
  assert.equal(sampled.at(-1).x, 990)
})
