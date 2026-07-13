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
