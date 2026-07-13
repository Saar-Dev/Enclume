import test from 'node:test'
import assert from 'node:assert/strict'

import {
  cellsToMeters,
  createWorldMetrics,
  dbPositionToWorldPoint,
  distanceBetweenWorldPointsM,
  levelToMeters,
  metersToCells,
  worldPointToDbPosition,
} from './worldMetrics.js'

test('WorldMetrics convertit la grille en mètres sans confondre cases et mètres', () => {
  const metrics = createWorldMetrics({ metersPerCell: 1.5 })
  assert.equal(cellsToMeters(10, metrics), 15)
  assert.equal(metersToCells(15, metrics), 10)
  assert.equal(distanceBetweenWorldPointsM({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, metrics), 15)
})

test('la hauteur d’étage utilise la même métrique physique', () => {
  const metrics = createWorldMetrics({ metersPerCell: 1.5, storyHeightWorld: 2.5 })
  assert.equal(metrics.storyHeightM, 3.75)
  assert.equal(levelToMeters(2, metrics), 7.5)
})

test('les adaptateurs PE14 isolent l’inversion profondeur/altitude', () => {
  const world = dbPositionToWorldPoint({ pos_x: 4, pos_y: 8, pos_z: 2 })
  assert.deepEqual(world, { x: 4, y: 2, z: 8 })
  assert.deepEqual(worldPointToDbPosition(world), { pos_x: 4, pos_y: 8, pos_z: 2 })
})

test('une métrique invalide est refusée au lieu de propager NaN', () => {
  assert.throws(() => createWorldMetrics({ metersPerCell: 0 }), /strictement positif/)
  assert.throws(() => createWorldMetrics({ storyHeightWorld: 'abc' }), /nombre fini/)
})
