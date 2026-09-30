import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveSelectHit } from './resolveSelectHit.js'

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

const noConnector = () => null

test('resolveSelectHit : un connecteur sous le clic prime, la recherche de salle ne se fait même pas', () => {
  const surface = emptySurface()
  const result = resolveSelectHit({
    surfaceData: surface,
    finalDrag: { start: { x: 0, z: 0 }, end: { x: 0, z: 0 } },
    editLevel: 0,
    isSingleCell: true,
    clickPoint: { x: 0.5, y: 0, z: 0.5 },
    findConnectorAtWorldPoint: () => ({ id: 'connector-1' }),
  })
  assert.deepEqual(result, { kind: 'connector', connectorId: 'connector-1' })
})

test('resolveSelectHit : clic simple sur une salle unique renvoie son patch', () => {
  const surface = emptySurface({ rooms: { r1: room('r1', 0) } })
  const result = resolveSelectHit({
    surfaceData: surface,
    finalDrag: { start: { x: 0, z: 0 }, end: { x: 0, z: 0 } },
    editLevel: 0,
    isSingleCell: true,
    clickPoint: { x: 0.5, y: 0, z: 0.5 },
    findConnectorAtWorldPoint: noConnector,
  })
  assert.equal(result.kind, 'room')
  assert.equal(result.roomId, 'r1')
  assert.equal(result.patch.selectedRoomId, 'r1')
})

test('resolveSelectHit : clic simple hors de toute salle renvoie une liste vide (efface la sélection)', () => {
  const surface = emptySurface()
  const result = resolveSelectHit({
    surfaceData: surface,
    finalDrag: { start: { x: 9, z: 9 }, end: { x: 9, z: 9 } },
    editLevel: 0,
    isSingleCell: true,
    clickPoint: { x: 9.5, y: 0, z: 9.5 },
    findConnectorAtWorldPoint: noConnector,
  })
  assert.deepEqual(result, { kind: 'rooms', roomIds: [] })
})

test('resolveSelectHit : rectangle englobant deux salles renvoie leurs deux ids', () => {
  const surface = emptySurface({
    rooms: {
      r1: room('r1', 0),
      r2: { ...room('r2', 0), minX: 3, maxX: 4, minZ: 3, maxZ: 4 },
    },
  })
  const result = resolveSelectHit({
    surfaceData: surface,
    finalDrag: { start: { x: 0, z: 0 }, end: { x: 4, z: 4 } },
    editLevel: 0,
    isSingleCell: false,
    clickPoint: null,
    findConnectorAtWorldPoint: noConnector,
  })
  assert.equal(result.kind, 'rooms')
  assert.deepEqual(new Set(result.roomIds), new Set(['r1', 'r2']))
})
