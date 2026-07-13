import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyRoomBoundaryArc,
  applyRoomSelection,
  computeSurfaceWaterCells,
  deleteRoomBoundaryWalls,
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
} from './surfaceData.js'
import {
  roomGeometryArea,
  roomGeometryIntersectionArea,
} from '../../../shared/world/roomGeometry.js'

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

  assert.equal(result.version, 8)
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
  assert.equal(result.surfaceData.version, 8)
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
