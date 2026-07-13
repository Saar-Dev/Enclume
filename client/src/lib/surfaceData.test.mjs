import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyRoomSelection,
  computeSurfaceWaterCells,
  expandRoomsToSurface,
  findRoomAtCell,
  getRoomFootprintCells,
  getWallRenderBox,
  isWorldPointVisibleAtLevel,
  makeWallsFromDrag,
  roomFootprintRectangles,
  roomsWallSegments,
} from './surfaceData.js'

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

  assert.equal(result.version, 5)
  assert.equal(getRoomFootprintCells(result.rooms.outer).length, 12)
  assert.equal(getRoomFootprintCells(result.rooms[nestedId]).length, 4)
  assert.equal(findRoomAtCell(result, { x: 1, z: 1 }, 0).id, nestedId)
  assert.equal(findRoomAtCell(result, { x: 0, z: 0 }, 0).id, 'outer')
  assert.equal(roomFootprintRectangles(result.rooms.outer).length, 4)

  const expanded = expandRoomsToSurface(result)
  assert.equal(Object.keys(expanded.floors).length, 16)
  assert.equal(roomsWallSegments(result.rooms).filter(wall => wall.roomIds.length === 2).length, 8)
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
