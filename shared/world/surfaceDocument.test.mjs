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
        floorTex: 10,
        wallInteriorTex: 11,
      },
    },
    floors: {},
    walls: {},
    ceilings: {},
    stairs: {
      'stair:legacy': {
        id: 'stair:legacy',
        kind: 'straight',
        axis: 'x',
        dir: 1,
        x: 0.5,
        z: 0.5,
        y: 0,
        topY: 2.5,
        width: 1,
        treadDepth: 0.2,
        stepCount: 21,
        supportThickness: 0.25,
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

test('un escalier structurel devient un connecteur canonique du document monde', () => {
  const prepared = prepareSurfaceData(surfaceFixture(), { battlemapId: 'map-a' })
  const stairId = prepared.surfaceData.stairs['stair:legacy'].worldId
  assert.equal(prepared.worldDocument.features.connectors[stairId].type, 'stairs')
  assert.equal(prepared.worldDocument.features.connectors[stairId].sourceCollection, 'stairs')
})

test('un escalier en colimaçon est une définition structurelle valide', () => {
  const surface = surfaceFixture()
  surface.stairs['stair:legacy'] = {
    id: 'stair:spiral', kind: 'spiral', x: 2.5, z: 3.5, y: 0, topY: 2.5,
    outerRadius: 1.25, innerRadius: 0.22, totalTurns: 1.25,
    rotationQuarterTurns: 0, stepCount: 21, supportThickness: 0.25,
    treadThickness: 0.055,
  }
  assert.equal(validateSurfaceData(surface).valid, true)

  surface.stairs['stair:legacy'].innerRadius = 2
  assert.equal(validateSurfaceData(surface).valid, false)
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

test('la v9 valide le profil vertical canonique et ses murs par tranche', () => {
  const surface = surfaceFixture()
  surface.version = 9
  surface.rooms['room:legacy'] = {
    ...surface.rooms['room:legacy'],
    heightLevels: 1,
    verticalProfile: {
      slices: [{
        offset: 0,
        footprint: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
        wallPaths: [
          { axis: 'x', x0: 0, z0: 0, x1: 1, z1: 0 },
          { axis: 'z', x0: 1, z0: 0, x1: 1, z1: 1 },
          { axis: 'x', x0: 1, z0: 1, x1: 0, z1: 1 },
          { axis: 'z', x0: 0, z0: 1, x1: 0, z1: 0 },
        ],
      }],
    },
  }
  assert.equal(validateSurfaceData(surface).valid, true)

  surface.rooms['room:legacy'].verticalProfile.slices[0].offset = 2
  assert.equal(validateSurfaceData(surface).valid, false)
})

test('la préparation redérive la hauteur depuis les tranches canoniques', () => {
  const surface = surfaceFixture()
  surface.version = 10
  const footprint = [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]]
  surface.rooms['room:legacy'] = {
    ...surface.rooms['room:legacy'],
    heightLevels: 1,
    height: 2.5,
    verticalProfile: {
      slices: [0, 1, 2].map(offset => ({
        offset,
        footprint,
        wallPaths: [
          { axis: 'x', x0: 0, z0: 0, x1: 1, z1: 0 },
          { axis: 'z', x0: 1, z0: 0, x1: 1, z1: 1 },
          { axis: 'x', x0: 1, z0: 1, x1: 0, z1: 1 },
          { axis: 'z', x0: 0, z0: 1, x1: 0, z1: 0 },
        ],
      })),
    },
  }

  assert.equal(validateSurfaceData(surface).valid, false)
  const prepared = prepareSurfaceData(surface, { battlemapId: 'map-height-repair' })
  assert.equal(prepared.surfaceData.rooms['room:legacy'].heightLevels, 3)
  assert.equal(prepared.surfaceData.rooms['room:legacy'].height, 7.5)
  assert.equal(prepared.surfaceData.rooms['room:legacy'].verticalProfile.slices.length, 3)
})

test('la v10 valide les profils verticaux paramétriques des faces de mur', () => {
  const surface = surfaceFixture()
  surface.version = 10
  surface.rooms['room:legacy'].wallElevationProfiles = [{
    id: 'wall-profile:test',
    edgeKeys: ['edge:0:0|1:0'],
    profile: { type: 'curved', depth: 0.75, direction: 1 },
  }]
  assert.equal(validateSurfaceData(surface).valid, true)

  surface.rooms['room:legacy'].wallElevationProfiles[0].profile.depth = 8
  assert.equal(validateSurfaceData(surface).valid, false)
})

test('la v12 valide l apparence interieure persistante par mur', () => {
  const surface = surfaceFixture()
  surface.version = 12
  surface.rooms['room:legacy'].wallAppearanceProfiles = [{
    id: 'wall-appearance:test',
    edgeKeys: ['edge:0:0|1:0'],
    interiorTex: 'wall-inside',
    interiorMaterial: {
      material: 'steel',
      paint: '#aabbcc',
      pattern: 'metal_panels',
      wear: 0,
      dirt: 12,
      relief: 35,
      realRelief: true,
      seed: 'test',
    },
  }]
  assert.equal(validateSurfaceData(surface).valid, true)
  assert.ok(collectSurfaceTextureIds(surface).includes('wall-inside'))

  surface.rooms['room:legacy'].wallAppearanceProfiles[0].interiorMaterial.wear = 101
  assert.equal(validateSurfaceData(surface).valid, false)
})

test('la v12 refuse les anciennes faces d apparence des salles', () => {
  const surface = surfaceFixture()
  surface.version = 12
  surface.rooms['room:legacy'].floorTopTex = 'obsolete'

  const validation = validateSurfaceData(surface)
  assert.equal(validation.valid, false)
  assert.ok(validation.errors.some(error => error.includes('floorTopTex')))
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
  surface.connectors.ladder = { id: 'ladder', type: 'ladder', tex: 14 }
  assert.deepEqual([...collectSurfaceTextureIds(surface)].sort((a, b) => a - b), [10, 11, 12, 13, 14])
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

test('la v8 valide une porte ancree dans le repere parametrique d un arc', () => {
  const surface = surfaceFixture()
  surface.version = 8
  surface.connectors.curvedDoor = {
    type: 'door',
    axis: 'segment',
    x0: 0,
    z0: 0,
    x1: 2,
    z1: 2,
    y: 0,
    anchorX: 0.25,
    anchorZ: 0.25,
    tangentX: Math.SQRT1_2,
    tangentZ: Math.SQRT1_2,
    normalX: -Math.SQRT1_2,
    normalZ: Math.SQRT1_2,
    rotationY: -Math.PI / 4,
    curveId: 'room:legacy:arc:test',
    curveOffset: 1.2,
  }
  assert.equal(validateSurfaceData(surface).valid, true)

  delete surface.connectors.curvedDoor.curveOffset
  assert.equal(validateSurfaceData(surface).valid, false)
})

test('les fenêtres et verrières structurelles sont validées comme connecteurs canoniques', () => {
  const surface = surfaceFixture()
  surface.connectors.screen = {
    type: 'screen-window',
    axis: 'x',
    x0: 0,
    x1: 4,
    z0: 0,
    z1: 0,
    y: 0.5,
    allowedStates: ['transparent', 'opaque', 'mirror'],
    modelFacing: 'back',
  }
  surface.connectors.skylight = {
    type: 'skylight',
    x: 0,
    z: 0,
    y: 0,
    width: 2,
    depth: 1,
  }

  const prepared = prepareSurfaceData(surface, { battlemapId: 'map-structural-windows' })
  assert.equal(validateSurfaceData(prepared.surfaceData).valid, true)
  assert.match(prepared.surfaceData.connectors.screen.worldId, /^[0-9a-f-]{36}$/)
  assert.equal(prepared.surfaceData.connectors.screen.modelFacing, 'back')
  assert.match(prepared.surfaceData.connectors.skylight.worldId, /^[0-9a-f-]{36}$/)

  surface.connectors.screen.allowedStates = ['transparent', 'open']
  assert.equal(validateSurfaceData(surface).valid, false)
  surface.connectors.screen.allowedStates = ['transparent']
  surface.connectors.screen.modelFacing = 'sideways'
  assert.equal(validateSurfaceData(surface).valid, false)
  surface.connectors.screen.modelFacing = 'front'
  surface.connectors.skylight.width = 0
  assert.equal(validateSurfaceData(surface).valid, false)
})

test('une trappe exige une échelle liée et un état autorisé', () => {
  const surface = surfaceFixture()
  surface.connectors.ladder = {
    id: 'ladder', type: 'ladder', x: 0, z: 0,
    fromLevel: 0, toLevel: 1, fromY: 0.125, toY: 2.625,
  }
  surface.connectors.hatch = {
    id: 'hatch', type: 'hatch', linkedLadderId: 'ladder',
    x: 0, z: 0, y: 2.5, width: 1, depth: 1, height: 0.25,
    axis: 'x', hingeSide: 1, rotationQuarterTurns: 0, state: 'closed',
    allowedStates: ['closed', 'open', 'locked'],
  }
  assert.equal(validateSurfaceData(surface).valid, true)

  surface.connectors.hatch.state = 'jammed'
  assert.equal(validateSurfaceData(surface).valid, false)
  surface.connectors.hatch.state = 'closed'
  surface.connectors.hatch.rotationQuarterTurns = 4
  assert.equal(validateSurfaceData(surface).valid, false)
  surface.connectors.hatch.rotationQuarterTurns = 0
  surface.connectors.hatch.linkedLadderId = 'missing'
  assert.equal(validateSurfaceData(surface).valid, false)
})
