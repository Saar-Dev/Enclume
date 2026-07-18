import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorldSnapshot } from './worldContracts.js'
import {
  actorBoundsAt,
  createOccupancyIndex,
  createSpatialIndex,
  segmentGeometryInterval,
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

test('un collider en arc tesselle la primitive canonique seulement pour le narrow phase', () => {
  const geometry = {
    type: 'wall-arc',
    center: { x: 0, z: 0 },
    radius: 1,
    startAngle: 0,
    sweep: Math.PI / 2,
    minY: 0,
    maxY: 2.5,
    thickness: 0.1,
  }
  const curved = createWorldSnapshot({
    spatial: {
      supports: [], barriers: [], traversals: [], occluders: [], compartments: [], regions: [],
      colliders: [{
        id: 'arc', sourceId: 'arc', kind: 'wall', geometry,
        bounds: { min: { x: -0.05, y: 0, z: -0.05 }, max: { x: 1.05, y: 2.5, z: 1.05 } },
      }],
    },
  })
  const index = createSpatialIndex(curved)
  const actor = { radius: 0.02, height: 1.8, maxStepHeight: 0.5 }

  assert.equal(index.isSegmentClear({ x: 0.1, y: 0, z: 0.5 }, { x: 0.3, y: 0, z: 0.5 }, actor), true)
  assert.equal(index.isSegmentClear({ x: 0.1, y: 0, z: 0.5 }, { x: 1.2, y: 0, z: 0.5 }, actor), false)
})

test('les marches courbes et la colonne utilisent leur volume réel pour la ligne de vue', () => {
  const tread = {
    type: 'horizontal-prism',
    polygon: [
      { x: 0.2, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 0.25 }, { x: 0.2, z: 0.1 },
    ],
    minY: 1,
    maxY: 1.08,
  }
  assert.ok(segmentGeometryInterval(
    { x: 0.5, y: 0.5, z: 0.05 },
    { x: 0.5, y: 1.5, z: 0.05 },
    tread,
  ))
  assert.equal(segmentGeometryInterval(
    { x: 0.05, y: 0.5, z: 0.2 },
    { x: 0.05, y: 1.5, z: 0.2 },
    tread,
  ), null)

  const column = {
    type: 'vertical-cylinder',
    center: { x: 0, z: 0 },
    radius: 0.2,
    minY: 0,
    maxY: 3,
  }
  assert.ok(segmentGeometryInterval(
    { x: -1, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
    column,
  ))
  assert.equal(segmentGeometryInterval(
    { x: -1, y: 1, z: 0.3 },
    { x: 1, y: 1, z: 0.3 },
    column,
  ), null)
})

test('un plancher découpé suit son multipolygone au lieu de sa boîte englobante', () => {
  const slab = {
    type: 'horizontal-multipolygon',
    multiPolygon: [[
      [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]],
      [[0.75, 0.75], [0.75, 1.25], [1.25, 1.25], [1.25, 0.75], [0.75, 0.75]],
    ]],
    minY: 1,
    maxY: 1.1,
  }

  assert.ok(segmentGeometryInterval(
    { x: 0.25, y: 0.5, z: 1 },
    { x: 0.25, y: 1.5, z: 1 },
    slab,
  ))
  assert.equal(segmentGeometryInterval(
    { x: 1, y: 0.5, z: 1 },
    { x: 1, y: 1.5, z: 1 },
    slab,
  ), null)
})

test('le narrow phase suit le profil vertical et l épaisseur variable d un mur', () => {
  const base = {
    type: 'wall-segment',
    from: { x: 0, z: 0 },
    to: { x: 1, z: 0 },
    minY: 0,
    maxY: 2.5,
    thickness: 0.1,
    elevationProfileOriginY: 0,
    elevationProfileHeight: 2.5,
  }
  const translated = {
    ...base,
    elevationProfileMode: 'translated',
    elevationProfile: { type: 'curved', depth: 1, direction: 1 },
    elevationProfileDirection: 1,
  }
  assert.ok(segmentGeometryInterval(
    { x: 0.5, y: 1.25, z: 0.8 },
    { x: 0.5, y: 1.25, z: 1.2 },
    translated,
  ))
  assert.equal(segmentGeometryInterval(
    { x: 0.5, y: 1.25, z: -0.2 },
    { x: 0.5, y: 1.25, z: 0.2 },
    translated,
  ), null)
  assert.ok(segmentGeometryInterval(
    { x: -0.25, y: 1.25, z: 0.8 },
    { x: -0.25, y: 1.25, z: 1.2 },
    { ...translated, profileJoinStartPadding: 0.5 },
  ))

  const sharedFace = {
    ...base,
    elevationProfileMode: 'faces',
    frontElevationProfile: { type: 'faceted', depth: 0.8, direction: 1 },
  }
  assert.ok(segmentGeometryInterval(
    { x: 0.5, y: 1.25, z: 0.6 },
    { x: 0.5, y: 1.25, z: 1 },
    sharedFace,
  ))
  assert.equal(segmentGeometryInterval(
    { x: 0.5, y: 1.25, z: -0.5 },
    { x: 0.5, y: 1.25, z: -0.2 },
    sharedFace,
  ), null)
})
