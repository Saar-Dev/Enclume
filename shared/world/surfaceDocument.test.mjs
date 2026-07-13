import test from 'node:test'
import assert from 'node:assert/strict'

import {
  collectSurfaceTextureIds,
  deterministicWorldId,
  prepareSurfaceData,
  validateSurfaceData,
} from './surfaceDocument.js'

function surfaceFixture() {
  return {
    version: 4,
    fine: 4,
    storyHeight: 2.5,
    rooms: {
      'room:legacy': {
        id: 'room:legacy',
        minX: 0,
        maxX: 0,
        minZ: 0,
        maxZ: 0,
        floorTopTex: 10,
        wallInteriorTex: 11,
      },
    },
    floors: {},
    walls: {},
    ceilings: {},
    stairs: {
      'stair:legacy': {
        id: 'stair:legacy',
        axis: 'x',
        dir: 1,
        minX: 0,
        maxX: 1,
        minZ: 0,
        maxZ: 0,
        y: 0,
        topY: 2.5,
        tex: 12,
      },
    },
    connectors: {},
  }
}

test('les identités legacy deviennent des UUID déterministes et persistables', () => {
  const first = prepareSurfaceData(surfaceFixture(), { battlemapId: 'map-a' })
  const second = prepareSurfaceData(first.surfaceData, { battlemapId: 'map-a' })
  const otherMap = prepareSurfaceData(surfaceFixture(), { battlemapId: 'map-b' })

  const roomId = first.surfaceData.rooms['room:legacy'].worldId
  assert.match(roomId, /^[0-9a-f-]{36}$/)
  assert.equal(second.surfaceData.rooms['room:legacy'].worldId, roomId)
  assert.notEqual(otherMap.surfaceData.rooms['room:legacy'].worldId, roomId)
  assert.equal(first.worldDocument.features.rooms[roomId].legacyId, 'room:legacy')
})

test('les escaliers legacy deviennent des connecteurs canoniques', () => {
  const prepared = prepareSurfaceData(surfaceFixture(), { battlemapId: 'map-a' })
  const stairId = prepared.surfaceData.stairs['stair:legacy'].worldId
  assert.equal(prepared.worldDocument.features.connectors[stairId].type, 'stairs')
  assert.equal(prepared.worldDocument.features.connectors[stairId].sourceCollection, 'stairs')
})

test('un segment orienté est un mur canonique valide', () => {
  const surface = surfaceFixture()
  surface.walls.curve = {
    axis: 'segment',
    x0: 0,
    z0: 0,
    x1: 1.5,
    z1: 2.5,
    y: 0,
    height: 2.5,
    thickness: 1,
  }
  assert.equal(validateSurfaceData(surface).valid, true)
})

test('une empreinte de salle v6 exige des cases entières uniques dans ses bornes', () => {
  const surface = surfaceFixture()
  surface.version = 6
  surface.rooms['room:legacy'] = {
    ...surface.rooms['room:legacy'],
    minX: 0,
    maxX: 1,
    minZ: 0,
    maxZ: 1,
    shape: 'footprint',
    cells: ['0:0', '1:0', '0:1'],
  }
  assert.equal(validateSurfaceData(surface).valid, true)

  surface.rooms['room:legacy'].cells.push('0:0', '4:4')
  assert.equal(validateSurfaceData(surface).valid, false)
})

test('un arc de contour v6 est validé comme géométrie de salle', () => {
  const surface = surfaceFixture()
  surface.version = 6
  surface.rooms['room:legacy'] = {
    ...surface.rooms['room:legacy'],
    minX: 0,
    maxX: 1,
    minZ: 0,
    maxZ: 1,
    cells: ['0:0', '1:0', '0:1', '1:1'],
  }
  surface.rooms['room:legacy'].boundaryArcs = [{
    id: 'arc:test',
    edgeKeys: [
      'edge:0:0|0:1',
      'edge:0:1|0:2',
      'edge:0:0|1:0',
      'edge:1:0|2:0',
    ],
    start: { x: 0, z: 2 },
    end: { x: 2, z: 0 },
    angleDegrees: 90,
    side: 1,
  }]
  assert.equal(validateSurfaceData(surface).valid, true)

  surface.rooms['room:legacy'].boundaryArcs[0].angleDegrees = 190
  assert.equal(validateSurfaceData(surface).valid, false)

  surface.rooms['room:legacy'].boundaryArcs[0].angleDegrees = 90
  surface.rooms['room:legacy'].boundaryArcs[0].end = { x: 9, z: 9 }
  assert.equal(validateSurfaceData(surface).valid, false)
})

test('les versions futures et les coordonnées corrompues sont refusées', () => {
  const future = surfaceFixture()
  future.version = 99
  assert.equal(validateSurfaceData(future).valid, false)

  const broken = surfaceFixture()
  broken.rooms['room:legacy'].minX = 'pas-un-nombre'
  assert.equal(validateSurfaceData(broken).valid, false)
})

test('la collecte texture couvre salles, escaliers et surfaces sans doublon', () => {
  const surface = surfaceFixture()
  surface.floors['0:0:0'] = { y: 0, tex: 10, topTex: 13 }
  assert.deepEqual([...collectSurfaceTextureIds(surface)].sort((a, b) => a - b), [10, 11, 12, 13])
})

test('le générateur d’identité est stable pour un même triplet', () => {
  assert.equal(
    deterministicWorldId('map-a', 'rooms', 'room:legacy'),
    deterministicWorldId('map-a', 'rooms', 'room:legacy'),
  )
})

test('la v7 valide les murs ouverts et les dependances geometriques', () => {
  const surface = surfaceFixture()
  surface.version = 7
  surface.rooms['room:legacy'].openWallEdgeKeys = ['edge:0:0|1:0']
  surface.rooms.adjacent = {
    id: 'adjacent',
    minX: 0,
    maxX: 0,
    minZ: 0,
    maxZ: 0,
    geometryClipRoomIds: ['room:legacy'],
  }

  assert.equal(validateSurfaceData(surface).valid, true)
})

test('la v7 refuse une dependance absente ou un cycle de decoupe', () => {
  const missing = surfaceFixture()
  missing.version = 7
  missing.rooms['room:legacy'].geometryClipRoomIds = ['missing']
  assert.equal(validateSurfaceData(missing).valid, false)

  const cyclic = surfaceFixture()
  cyclic.version = 7
  cyclic.rooms.other = {
    id: 'other',
    minX: 1,
    maxX: 1,
    minZ: 0,
    maxZ: 0,
    geometryClipRoomIds: ['room:legacy'],
  }
  cyclic.rooms['room:legacy'].geometryClipRoomIds = ['other']
  assert.equal(validateSurfaceData(cyclic).valid, false)
})
