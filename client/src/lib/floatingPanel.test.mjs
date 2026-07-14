import test from 'node:test'
import assert from 'node:assert/strict'

import { clampFloatingPanelPosition } from './floatingPanel.js'

test('un panneau flottant garde son en-tête dans la fenêtre', () => {
  assert.deepEqual(clampFloatingPanelPosition({
    left: 900,
    top: 800,
    width: 300,
    height: 700,
    viewportWidth: 1000,
    viewportHeight: 600,
  }), { left: 692, top: 552 })
  assert.deepEqual(clampFloatingPanelPosition({
    left: -50,
    top: -20,
    width: 300,
    height: 700,
    viewportWidth: 1000,
    viewportHeight: 600,
  }), { left: 8, top: 8 })
})
