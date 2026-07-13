import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeSurfaceWaterCells,
  getWallRenderBox,
  isWorldPointVisibleAtLevel,
  makeWallsFromDrag,
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
