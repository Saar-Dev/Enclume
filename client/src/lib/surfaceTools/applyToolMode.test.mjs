import test from 'node:test'
import assert from 'node:assert/strict'

import { applyToolMode } from './applyToolMode.js'
import { applyBridgeSelection, applyFloorSelection, applyStairSelection, eraseSurfaceSelection } from '../surfaceData.js'
import { applyWallDrag } from '../surfaceGeometry.js'

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

const drag = { start: { x: 0, z: 0 }, end: { x: 2, z: 2 } }
const tool = { level: 0 }

test('applyToolMode(wall) équivaut à applyWallDrag(start, end) directement', () => {
  const surface = emptySurface()
  const viaRegistry = applyToolMode('wall', surface, drag, tool, null, [])
  const direct = applyWallDrag(surface, drag.start, drag.end, tool, null, [])
  assert.deepEqual(viaRegistry, direct)
})

test('applyToolMode(stair) équivaut à applyStairSelection direct', () => {
  const surface = emptySurface()
  const viaRegistry = applyToolMode('stair', surface, drag, tool, null, [])
  const direct = applyStairSelection(surface, drag, tool, null, [])
  assert.deepEqual(viaRegistry, direct)
})

test('applyToolMode(bridge) équivaut à applyBridgeSelection direct', () => {
  const surface = emptySurface()
  const viaRegistry = applyToolMode('bridge', surface, drag, tool, null, [])
  const direct = applyBridgeSelection(surface, drag, tool, null, [])
  assert.deepEqual(viaRegistry, direct)
})

test('applyToolMode(erase) équivaut à eraseSurfaceSelection direct (ignore activeMaterial/availableBlocks)', () => {
  const surface = emptySurface()
  const viaRegistry = applyToolMode('erase', surface, drag, tool, null, [])
  const direct = eraseSurfaceSelection(surface, drag, tool)
  assert.deepEqual(viaRegistry, direct)
})

test('applyToolMode retombe sur applyFloorSelection pour un mode non listé (select/room/... gérés ailleurs)', () => {
  const surface = emptySurface()
  const viaRegistry = applyToolMode('select', surface, drag, tool, null, [])
  const direct = applyFloorSelection(surface, drag, tool, null, [])
  assert.deepEqual(viaRegistry, direct)
})
