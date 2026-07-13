import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyRoomBoundaryArc,
  applyRoomWallElevationProfile,
  applyRoomSelection,
  computeSurfaceWaterCells,
  deleteRoomBoundaryWalls,
  deleteSurfaceRoom,
  expandRoomsToSurface,
  findRoomAtCell,
  getRoomFootprintCells,
  getRoomBoundaryWallRuns,
  getWallRenderBox,
  isWorldPointVisibleAtLevel,
  makeDoorConnectorFromWallPoint,
  makeWallsFromDrag,
  roomFootprintRectangles,
  roomsWallRenderPaths,
  roomsWallSegments,
  wallProfileVerticalProgresses,
} from './surfaceData.js'
import {
  multiPolygonGridCells,
  roomGeometryArea,
  roomGeometryIntersectionArea,
} from '../../../shared/world/roomGeometry.js'
import { prepareSurfaceData } from '../../../shared/world/surfaceDocument.js'

function emptySurface(patch = {}) {
  return {
    version: 4,
    fine: 4,
    storyHeight: 2.5,
    rooms: {},
    floors: {},
    walls: {},
    ceilings: {},
    stairs: {},
    connectors: {},
    ...patch,
  }
}

function room(id, level, heightLevels = 1) {
  return {
    id,
    minX: 0,
    maxX: 1,
    minZ: 0,
    maxZ: 1,
    level,
    y: level * 2.5,
    heightLevels,
    floorEnabled: true,
    wallEnabled: true,
    ceilingEnabled: true,
    floorThickness: 0.25,
    wallThickness: 1,
    ceilingThickness: 0.25,
    blocksWater: true,
  }
}

test('la surface extérieure de l eau utilise le sommet global de la carte', () => {
  const result = computeSurfaceWaterCells(emptySurface({
    rooms: {
      low: room('low', 0),
      high: room('high', 2),
    },
  }))

  assert.ok(result.waterCells.length > 0)
  assert.deepEqual([...new Set(result.waterCells.map(cell => cell.topY))], [7.5])
})

test('un mur courbe produit des segments orientés avec une boîte de rendu tournée', () => {
  const walls = makeWallsFromDrag(
    { fx: 0, fz: 0 },
    { fx: 16, fz: 0 },
    { wallShape: 'curve', wallCurveOffset: 2, wallHeightLevels: 1, level: 0 },
    null,
    [],
  )

  assert.ok(walls.length > 4)
  assert.ok(walls.every(wall => wall.axis === 'segment'))
  assert.ok(walls.some(wall => Math.abs(getWallRenderBox(wall).rotationY) > 0.01))
  assert.equal(walls[0].x0, 0)
  assert.equal(walls.at(-1).x1, 16)
})

test('un profil vertical extérieur translate les deux faces du mur', () => {
  const exteriorRoom = room('outside', 0)
  const west = getRoomBoundaryWallRuns(exteriorRoom).find(run => run.side === 'west')
  const result = applyRoomWallElevationProfile(
    emptySurface({ rooms: { outside: exteriorRoom } }),
    'outside',
    west.edgeKeys,
    { type: 'curved', depth: 0.6, direction: 1 },
  )

  assert.equal(result.error, null)
  const profiled = roomsWallSegments(result.surfaceData.rooms).find(wall => wall.elevationProfileMode)
  assert.equal(profiled.elevationProfileMode, 'translated')
  assert.equal(profiled.elevationProfile.depth, 0.6)
  assert.equal(profiled.roomIds.length, 1)
})

test('un mur profile se raccorde aussi a ses voisins restes verticaux', () => {
  const exteriorRoom = room('single-profile', 0)
  const west = getRoomBoundaryWallRuns(exteriorRoom).find(run => run.side === 'west')
  const result = applyRoomWallElevationProfile(
    emptySurface({ rooms: { 'single-profile': exteriorRoom } }),
    'single-profile',
    west.edgeKeys,
    { type: 'curved', depth: 0.6, direction: 1 },
  )
  const walls = roomsWallRenderPaths(result.surfaceData.rooms)
  const profiled = walls.filter(wall => wall.elevationProfileMode === 'translated')
  const joins = profiled.flatMap(wall => [wall.profileJoinStart, wall.profileJoinEnd]).filter(Boolean)

  assert.equal(result.error, null)
  assert.equal(joins.length, 2)
  assert.ok(joins.every(join => join.neighbor.elevationProfileMode === undefined))
  const straightNeighbor = walls.find(wall => (
    !wall.elevationProfileMode
    && [wall.profileJoinStart, wall.profileJoinEnd].some(join => (
      join?.front?.neighbor?.elevationProfileMode
      || join?.back?.neighbor?.elevationProfileMode
    ))
  ))
  const neighborLevels = wallProfileVerticalProgresses(straightNeighbor)
  assert.ok(neighborLevels.length > 2)
  assert.ok(neighborLevels.includes(0.5))
})

test('le profil vers l intérieur garde la même orientation sur tout le contour', () => {
  const profiledRoom = room('profiled', 0)
  const edgeKeys = getRoomBoundaryWallRuns(profiledRoom).flatMap(run => run.edgeKeys)
  const result = applyRoomWallElevationProfile(
    emptySurface({ rooms: { profiled: profiledRoom } }),
    'profiled',
    edgeKeys,
    { type: 'curved', depth: 0.5, direction: 1 },
  )
  const center = { x: 4, z: 4 }
  const walls = roomsWallSegments(result.surfaceData.rooms)
    .filter(wall => wall.elevationProfileMode === 'translated')

  assert.ok(walls.length >= 4)
  for (const wall of walls) {
    const dx = Number(wall.x1) - Number(wall.x0)
    const dz = Number(wall.z1) - Number(wall.z0)
    const length = Math.hypot(dx, dz)
    const normal = { x: -dz / length, z: dx / length }
    const midpoint = {
      x: (Number(wall.x0) + Number(wall.x1)) / 2,
      z: (Number(wall.z0) + Number(wall.z1)) / 2,
    }
    const direction = Number(wall.elevationProfileDirection) < 0 ? -1 : 1
    const inwardDot = normal.x * direction * (center.x - midpoint.x)
      + normal.z * direction * (center.z - midpoint.z)
    assert.ok(inwardDot > 0, `profil mal orienté sur ${wall.id}`)
  }
  const renderWalls = roomsWallRenderPaths(result.surfaceData.rooms)
    .filter(wall => wall.elevationProfileMode === 'translated')
  const cornerJoins = renderWalls
    .flatMap(wall => [wall.profileJoinStart, wall.profileJoinEnd])
    .filter(Boolean)
  assert.ok(cornerJoins.length >= 4)
})

test('un contour arrondi conserve son profil vertical et ses raccords', () => {
  const baseRoom = { ...room('rounded-profile', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const allEdges = getRoomBoundaryWallRuns(baseRoom).flatMap(wall => wall.edgeKeys)
  const curvedEdges = getRoomBoundaryWallRuns(baseRoom)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const profiled = applyRoomWallElevationProfile(
    emptySurface({ rooms: { 'rounded-profile': baseRoom } }),
    'rounded-profile',
    allEdges,
    { type: 'faceted', depth: 0.5, direction: 1 },
  )
  const curved = applyRoomBoundaryArc(
    profiled.surfaceData,
    'rounded-profile',
    curvedEdges,
    90,
  )
  const arc = roomsWallRenderPaths(curved.surfaceData.rooms).find(wall => wall.axis === 'arc')

  assert.equal(curved.error, null)
  assert.equal(arc.elevationProfile.type, 'faceted')
  assert.equal(arc.elevationProfile.depth, 0.5)
  assert.ok(arc.profileJoinStartMiter)
  assert.ok(arc.profileJoinEndMiter)
})

test('un grand arc profile reste raccorde exactement aux murs droits', () => {
  const largeRoom = {
    ...room('large-rounded-profile', 0),
    minX: -6,
    maxX: 2,
    minZ: -1,
    maxZ: 9,
    cells: Array.from({ length: 11 }, (_, dz) => (
      Array.from({ length: 9 }, (_, dx) => `${-6 + dx}:${-1 + dz}`)
    )).flat(),
  }
  const curvedEdges = getRoomBoundaryWallRuns(largeRoom)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const profiled = applyRoomWallElevationProfile(
    emptySurface({ rooms: { 'large-rounded-profile': largeRoom } }),
    'large-rounded-profile',
    curvedEdges,
    { type: 'curved', depth: 0.25, direction: -1 },
  )
  const rounded = applyRoomBoundaryArc(
    profiled.surfaceData,
    'large-rounded-profile',
    curvedEdges,
    90,
  )
  const arc = roomsWallRenderPaths(rounded.surfaceData.rooms).find(wall => wall.axis === 'arc')

  assert.equal(profiled.error, null)
  assert.equal(rounded.error, null)
  assert.ok(arc.profileJoinStart)
  assert.ok(arc.profileJoinEnd)
})

test('une porte rigide bloque le changement de profil vertical de son mur', () => {
  const guardedRoom = room('guarded', 0)
  const west = getRoomBoundaryWallRuns(guardedRoom).find(run => run.side === 'west')
  const result = applyRoomWallElevationProfile(
    emptySurface({
      rooms: { guarded: guardedRoom },
      connectors: {
        door: { type: 'door', axis: 'z', x0: 0, x1: 0, z0: 0, z1: 4, y: 0 },
      },
    }),
    'guarded',
    west.edgeKeys,
    { type: 'curved', depth: 0.6, direction: 1 },
  )

  assert.match(result.error, /porte/i)
  assert.equal(result.surfaceData.rooms.guarded.wallElevationProfiles, undefined)
})

test('un profil vertical mitoyen ne modifie que la face de la salle sélectionnée', () => {
  const left = { ...room('left', 0), maxX: 0, maxZ: 0, cells: ['0:0'] }
  const right = { ...room('right', 0), minX: 1, maxX: 1, maxZ: 0, cells: ['1:0'] }
  const east = getRoomBoundaryWallRuns(left).find(run => run.side === 'east')
  const result = applyRoomWallElevationProfile(
    emptySurface({ rooms: { left, right } }),
    'left',
    east.edgeKeys,
    { type: 'faceted', depth: 0.75, direction: 1 },
  )

  assert.equal(result.error, null)
  assert.equal(result.surfaceData.rooms.right.wallElevationProfiles, undefined)
  const shared = roomsWallSegments(result.surfaceData.rooms).find(wall => wall.roomIds.length === 2)
  assert.equal(shared.elevationProfileMode, 'faces')
  assert.equal([shared.frontElevationProfile, shared.backElevationProfile].filter(Boolean).length, 1)
  const renderedShared = roomsWallRenderPaths(result.surfaceData.rooms)
    .find(wall => wall.roomIds.length === 2)
  const junctions = [renderedShared.profileJoinStart, renderedShared.profileJoinEnd]
  assert.ok(junctions.every(Boolean))
  for (const junction of junctions) {
    for (const side of ['front', 'back']) {
      const ownRoomIds = new Set(renderedShared[`${side}RoomIds`] || [])
      const faceJoin = junction[side]
      const neighborRoomIds = faceJoin.neighbor[`${faceJoin.neighborSide}RoomIds`] || []
      assert.ok(neighborRoomIds.some(roomId => ownRoomIds.has(roomId)))
    }
  }
})

test('une salle multiniveau revele uniquement son propre volume inferieur', () => {
  const surface = emptySurface({
    rooms: {
      well: room('well', 0, 3),
    },
  })

  assert.equal(isWorldPointVisibleAtLevel(surface, 2, 0.5, 0.5, 0), true)
  assert.equal(isWorldPointVisibleAtLevel(surface, 2, 4.5, 4.5, 0), false)
  assert.equal(isWorldPointVisibleAtLevel(surface, 1, 0.5, 0.5, 5), false)
  assert.equal(isWorldPointVisibleAtLevel(surface, 2, 4.5, 4.5, 5), true)
})

test('une nouvelle salle transfere ses cases et redessine le contour de la salle englobante', () => {
  const outer = {
    ...room('outer', 0),
    maxX: 3,
    maxZ: 3,
  }
  const surface = emptySurface({ rooms: { outer } })
  const result = applyRoomSelection(
    surface,
    { start: { x: 1, z: 1 }, end: { x: 2, z: 2 } },
    { level: 0, roomHeightLevels: 1, wallHeightLevels: 1 },
    null,
    [],
  )
  const nestedId = 'room:1:1:2:2:0:1'

  assert.equal(result.version, 10)
  assert.equal(getRoomFootprintCells(result.rooms.outer).length, 12)
  assert.equal(getRoomFootprintCells(result.rooms[nestedId]).length, 4)
  assert.equal(findRoomAtCell(result, { x: 1, z: 1 }, 0).id, nestedId)
  assert.equal(findRoomAtCell(result, { x: 0, z: 0 }, 0).id, 'outer')
  assert.equal(roomFootprintRectangles(result.rooms.outer).length, 4)

  const expanded = expandRoomsToSurface(result)
  assert.equal(Object.keys(expanded.floors).length, 16)
  assert.equal(roomsWallSegments(result.rooms).filter(wall => wall.roomIds.length === 2).length, 8)
})

test('un arrondi de salle remplace une chaîne de murs dans le rendu de la salle', () => {
  const baseRoom = { ...room('rounded', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const surface = emptySurface({ rooms: { rounded: baseRoom } })
  const selected = getRoomBoundaryWallRuns(baseRoom).filter(wall => ['west', 'north'].includes(wall.side))
  const result = applyRoomBoundaryArc(surface, 'rounded', selected.flatMap(wall => wall.edgeKeys), 90)

  assert.equal(result.error, null)
  assert.equal(result.surfaceData.version, 10)
  assert.equal(result.surfaceData.rooms.rounded.boundaryArcs.length, 1)
  assert.ok(roomsWallSegments(result.surfaceData.rooms).some(wall => wall.axis === 'segment'))
})

test('une porte existante empêche de courber son mur porteur', () => {
  const baseRoom = { ...room('rounded', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const selected = getRoomBoundaryWallRuns(baseRoom).filter(wall => ['west', 'north'].includes(wall.side))
  const result = applyRoomBoundaryArc(emptySurface({
    rooms: { rounded: baseRoom },
    connectors: {
      door: { type: 'door', axis: 'x', x0: 0, x1: 4, z0: 0, z1: 0, y: 0 },
    },
  }), 'rounded', selected.flatMap(wall => wall.edgeKeys), 90)

  assert.match(result.error, /porte/)
})

test('une coupe qui separe une ancienne salle cree des composantes independantes', () => {
  const outer = { ...room('outer', 0), maxX: 2, maxZ: 2 }
  const result = applyRoomSelection(
    emptySurface({ rooms: { outer } }),
    { start: { x: 1, z: 0 }, end: { x: 1, z: 2 } },
    { level: 0, roomHeightLevels: 1, wallHeightLevels: 1 },
    null,
    [],
  )

  assert.equal(Object.keys(result.rooms).length, 3)
  assert.equal(findRoomAtCell(result, { x: 0, z: 1 }, 0).id, 'outer')
  assert.match(findRoomAtCell(result, { x: 2, z: 1 }, 0).id, /^outer:split:/)
  assert.equal(findRoomAtCell(result, { x: 1, z: 1 }, 0).id, 'room:1:0:1:2:0:1')
  assert.equal(Object.values(result.rooms).flatMap(getRoomFootprintCells).length, 9)
})

test('deux salles superposees sur des etages distincts conservent chacune leurs cases', () => {
  const ground = { ...room('ground', 0), maxX: 2, maxZ: 2 }
  const result = applyRoomSelection(
    emptySurface({ rooms: { ground } }),
    { start: { x: 1, z: 1 }, end: { x: 1, z: 1 } },
    { level: 1, roomHeightLevels: 1, wallHeightLevels: 1 },
    null,
    [],
  )

  assert.equal(getRoomFootprintCells(result.rooms.ground).length, 9)
  assert.equal(findRoomAtCell(result, { x: 1, z: 1 }, 0).id, 'ground')
  assert.equal(findRoomAtCell(result, { x: 1, z: 1 }, 1).id, 'room:1:1:1:1:1:1')
})

test('supprimer un mur exterieur ouvre la salle sans supprimer son sol', () => {
  const baseRoom = { ...room('roomA', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const north = getRoomBoundaryWallRuns(baseRoom).find(wall => wall.side === 'north')
  const before = roomsWallSegments({ roomA: baseRoom })
  const result = deleteRoomBoundaryWalls(
    emptySurface({ rooms: { roomA: baseRoom } }),
    'roomA',
    north.edgeKeys,
  )

  assert.equal(result.error, null)
  assert.deepEqual(result.surfaceData.rooms.roomA.openWallEdgeKeys.sort(), [...north.edgeKeys].sort())
  assert.equal(getRoomFootprintCells(result.surfaceData.rooms.roomA).length, 4)
  assert.equal(roomsWallSegments(result.surfaceData.rooms).length, before.length - north.edgeKeys.length)
})

test('supprimer un mur commun fusionne les deux salles et conserve la salle active', () => {
  const roomA = { ...room('roomA', 0), maxX: 0, maxZ: 0, cells: ['0:0'], floorTopTex: 101 }
  const roomB = { ...room('roomB', 0), minX: 1, maxX: 1, maxZ: 0, cells: ['1:0'], floorTopTex: 202 }
  const sharedWall = getRoomBoundaryWallRuns(roomA).find(wall => wall.side === 'east')
  const result = deleteRoomBoundaryWalls(emptySurface({
    rooms: { roomA, roomB },
    connectors: {
      door: { id: 'door', type: 'door', axis: 'z', x0: 4, x1: 4, z0: 0, z1: 4, y: 0 },
      ladder: { id: 'ladder', type: 'ladder', roomId: 'roomB', roomIds: ['roomB'], x: 1, z: 0 },
    },
  }), 'roomA', sharedWall.edgeKeys)

  assert.equal(result.error, null)
  assert.deepEqual(Object.keys(result.surfaceData.rooms), ['roomA'])
  assert.deepEqual(getRoomFootprintCells(result.surfaceData.rooms.roomA), [{ x: 0, z: 0 }, { x: 1, z: 0 }])
  assert.equal(result.surfaceData.rooms.roomA.floorTopTex, 101)
  assert.equal(result.surfaceData.connectors.door, undefined)
  assert.equal(result.surfaceData.connectors.ladder.roomId, 'roomA')
  assert.deepEqual(result.surfaceData.connectors.ladder.roomIds, ['roomA'])
  assert.equal(roomsWallSegments(result.surfaceData.rooms).length, 6)
})

test('supprimer une salle nettoie ses connecteurs et les références géométriques', () => {
  const source = emptySurface({
    rooms: {
      removed: room('removed', 0),
      survivor: {
        ...room('survivor', 0),
        minX: 2,
        maxX: 3,
        geometryClipRoomIds: ['removed'],
        boundaryArcs: [{ id: 'shared-arc', ownerRoomId: 'removed' }],
      },
    },
    connectors: {
      door: { id: 'door', type: 'door', roomId: 'removed', roomIds: ['removed', 'survivor'] },
      ladder: { id: 'ladder', type: 'ladder', roomIds: ['removed'] },
      free: { id: 'free', type: 'ladder', x: 10, z: 10 },
    },
  })
  const result = deleteSurfaceRoom(source, 'removed')

  assert.deepEqual(Object.keys(result.rooms), ['survivor'])
  assert.deepEqual(result.rooms.survivor.geometryClipRoomIds, [])
  assert.equal(result.rooms.survivor.boundaryArcs[0].ownerRoomId, 'survivor')
  assert.deepEqual(Object.keys(result.connectors), ['free'])
  assert.ok(source.rooms.removed)
})

test('fusionner des salles de hauteurs différentes conserve un profil vertical physique', () => {
  const roomA = { ...room('roomA', 0, 1), maxX: 0, maxZ: 0, cells: ['0:0'] }
  const roomB = { ...room('roomB', 0, 3), minX: 1, maxX: 1, maxZ: 0, cells: ['1:0'] }
  const sharedWall = getRoomBoundaryWallRuns(roomA).find(wall => wall.side === 'east')
  const result = deleteRoomBoundaryWalls(
    emptySurface({ rooms: { roomA, roomB } }),
    'roomA',
    sharedWall.edgeKeys,
  )

  assert.equal(result.error, null)
  assert.deepEqual(Object.keys(result.surfaceData.rooms), ['roomA'])
  const merged = result.surfaceData.rooms.roomA
  assert.equal(merged.heightLevels, 3)
  assert.equal(merged.verticalProfile.slices.length, 3)
  assert.deepEqual(
    merged.verticalProfile.slices.map(slice => multiPolygonGridCells(slice.footprint).length),
    [2, 1, 1],
  )

  const walls = roomsWallSegments(result.surfaceData.rooms)
  assert.equal(walls.filter(wall => wall.y === 0).length, 6)
  assert.equal(walls.filter(wall => wall.y === 2.5).length, 4)
  assert.equal(walls.filter(wall => wall.y === 5).length, 4)
  const expanded = expandRoomsToSurface(result.surfaceData)
  assert.ok(Object.keys(expanded.ceilings).some(key => key.endsWith(':0:2.5')))
  assert.ok(Object.keys(expanded.ceilings).some(key => key.endsWith(':0:7.5')))
})

test('une seconde fusion conserve une hauteur canonique sauvegardable', () => {
  const low = { ...room('low', 0, 1), maxX: 0, maxZ: 0, cells: ['0:0'] }
  const tall = { ...room('tall', 0, 3), minX: 1, maxX: 1, maxZ: 0, cells: ['1:0'] }
  const firstWall = getRoomBoundaryWallRuns(low).find(wall => wall.side === 'east')
  const first = deleteRoomBoundaryWalls(
    emptySurface({ rooms: { low, tall } }),
    'low',
    firstWall.edgeKeys,
  )
  const next = { ...room('next', 0, 1), minX: 2, maxX: 2, maxZ: 0, cells: ['2:0'] }
  const chainedSurface = {
    ...first.surfaceData,
    rooms: { ...first.surfaceData.rooms, next },
  }
  const secondWall = getRoomBoundaryWallRuns(next).find(wall => wall.side === 'west')
  const second = deleteRoomBoundaryWalls(chainedSurface, 'next', secondWall.edgeKeys)
  const merged = second.surfaceData.rooms.next

  assert.equal(second.error, null)
  assert.equal(merged.heightLevels, 3)
  assert.equal(merged.verticalProfile.slices.length, 3)
  assert.doesNotThrow(() => prepareSurfaceData(second.surfaceData, { battlemapId: 'chain-merge' }))
})

test('une nouvelle salle decoupe son volume sur la salle courbe deja presente', () => {
  const rounded = { ...room('rounded', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const selected = getRoomBoundaryWallRuns(rounded)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const curved = applyRoomBoundaryArc(
    emptySurface({ rooms: { rounded } }),
    'rounded',
    selected,
    90,
  ).surfaceData
  const result = applyRoomSelection(
    curved,
    { start: { x: 0, z: 0 }, end: { x: 1, z: 1 } },
    { level: 0, roomHeightLevels: 1, wallHeightLevels: 1 },
    null,
    [],
  )
  const createdId = 'room:0:0:1:1:0:1'

  assert.deepEqual(result.rooms[createdId].geometryClipRoomIds, ['rounded'])
  assert.equal(roomGeometryIntersectionArea(
    { id: 'rounded', ...result.rooms.rounded },
    { id: createdId, ...result.rooms[createdId] },
    result.rooms,
  ), 0)
  assert.ok(roomsWallSegments(result.rooms).some(wall => wall.axis === 'segment' && wall.roomIds.length === 2))
})

test('supprimer une separation courbe fusionne les volumes sans conserver un arc fantome', () => {
  const rounded = { ...room('rounded', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const selected = getRoomBoundaryWallRuns(rounded)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const curved = applyRoomBoundaryArc(
    emptySurface({ rooms: { rounded } }),
    'rounded',
    selected,
    90,
  ).surfaceData
  const split = applyRoomSelection(
    curved,
    { start: { x: 0, z: 0 }, end: { x: 1, z: 1 } },
    { level: 0, roomHeightLevels: 1, wallHeightLevels: 1 },
    null,
    [],
  )
  const merged = deleteRoomBoundaryWalls(split, 'rounded', selected)

  assert.equal(merged.error, null)
  assert.deepEqual(Object.keys(merged.surfaceData.rooms), ['rounded'])
  assert.deepEqual(merged.surfaceData.rooms.rounded.boundaryArcs, [])
  assert.equal(roomGeometryArea(
    { id: 'rounded', ...merged.surfaceData.rooms.rounded },
    merged.surfaceData.rooms,
  ), 4)
})

test('une porte sur un arc utilise le point, la tangente et la normale du mur canonique', () => {
  const rounded = { ...room('rounded', 0), cells: ['0:0', '1:0', '0:1', '1:1'] }
  const selected = getRoomBoundaryWallRuns(rounded)
    .filter(wall => ['west', 'north'].includes(wall.side))
    .flatMap(wall => wall.edgeKeys)
  const surface = applyRoomBoundaryArc(
    emptySurface({ rooms: { rounded } }),
    'rounded',
    selected,
    90,
  ).surfaceData
  const curvePanel = roomsWallSegments(surface.rooms).find(wall => wall.curveId)
  const wallPoint = {
    fx: (Number(curvePanel.x0) + Number(curvePanel.x1)) / 2,
    fz: (Number(curvePanel.z0) + Number(curvePanel.z1)) / 2,
  }
  const door = makeDoorConnectorFromWallPoint(surface, wallPoint, {
    selectedRoomId: 'rounded',
    level: 0,
    connectorModelGeometry: { width: 0.8, depth: 0.2, height: 2 },
  })

  assert.equal(door.axis, 'segment')
  assert.equal(door.curveId, curvePanel.curveId)
  assert.ok(Number.isFinite(door.curveOffset))
  assert.ok(Math.abs(Math.hypot(door.tangentX, door.tangentZ) - 1) < 1e-6)
  assert.ok(Math.abs(Math.hypot(door.normalX, door.normalZ) - 1) < 1e-6)
  assert.ok(Math.abs(door.tangentX * door.normalX + door.tangentZ * door.normalZ) < 1e-6)
  assert.ok(Math.abs(Math.hypot(
    door.anchorX - Number(curvePanel.curveCenterX),
    door.anchorZ - Number(curvePanel.curveCenterZ),
  ) - Number(curvePanel.curveRadius)) < 1e-6)
  assert.equal(roomsWallRenderPaths(surface.rooms).filter(wall => wall.axis === 'arc').length, 1)
})
