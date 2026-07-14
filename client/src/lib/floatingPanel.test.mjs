import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clampFloatingPanelPosition,
  floatingPanelPositionBesideAnchor,
} from './floatingPanel.js'

test('un panneau flottant garde son en-tête dans la fenêtre', () => {
  assert.deepEqual(clampFloatingPanelPosition({
    left: 900,
    top: 800,
    width: 300,
    height: 700,
    viewportWidth: 1000,
    viewportHeight: 600,
  }), { left: 692, top: 8 })
  assert.deepEqual(clampFloatingPanelPosition({
    left: -50,
    top: -20,
    width: 300,
    height: 700,
    viewportWidth: 1000,
    viewportHeight: 600,
  }), { left: 8, top: 8 })
})

test('un panneau choisit automatiquement le côté libre de son ancrage', () => {
  assert.deepEqual(floatingPanelPositionBesideAnchor({
    x: 400,
    y: 300,
    width: 200,
    height: 300,
    viewportWidth: 1000,
    viewportHeight: 600,
  }), { left: 422, top: 150 })
  assert.deepEqual(floatingPanelPositionBesideAnchor({
    x: 900,
    y: 300,
    width: 200,
    height: 300,
    viewportWidth: 1000,
    viewportHeight: 600,
  }), { left: 678, top: 150 })
})

test('un panneau agrandi remonte avant de sortir de la fenêtre', () => {
  assert.deepEqual(clampFloatingPanelPosition({
    left: 420,
    top: 330,
    width: 300,
    height: 520,
    viewportWidth: 1200,
    viewportHeight: 700,
  }), { left: 420, top: 172 })
})
