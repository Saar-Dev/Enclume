import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveReshapeRoomCellMode } from './resolveReshapeRoomCellMode.js'

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

test('resolveReshapeRoomCellMode : null sans salle sélectionnée', () => {
  const surface = emptySurface()
  assert.equal(resolveReshapeRoomCellMode(surface, null, { x: 0, z: 0 }), null)
})

test('resolveReshapeRoomCellMode : "remove" pour une case déjà dans l’empreinte', () => {
  const surface = emptySurface({ rooms: { r1: room('r1', 0) } })
  assert.equal(resolveReshapeRoomCellMode(surface, 'r1', { x: 0, z: 0 }), 'remove')
})

test('resolveReshapeRoomCellMode : "add" pour une case hors de l’empreinte', () => {
  const surface = emptySurface({ rooms: { r1: room('r1', 0) } })
  assert.equal(resolveReshapeRoomCellMode(surface, 'r1', { x: 9, z: 9 }), 'add')
})
