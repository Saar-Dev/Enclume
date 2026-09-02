import test from 'node:test'
import assert from 'node:assert/strict'

import {
  cellsToMeters,
  createWorldMetrics,
  dbPositionToWorldPoint,
  distanceBetweenWorldPointsM,
  distanceToSegmentM,
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

test('distanceToSegmentM projette sur le segment (altitude incluse), jamais sur un point d’ancrage', () => {
  const metrics = createWorldMetrics({ metersPerCell: 1 })
  const a = { x: 0, y: 0, z: 0 }
  const b = { x: 10, y: 0, z: 0 }

  // Perpendiculaire au milieu du segment (porte de 10m, joueur à 3m en face du centre).
  assert.equal(distanceToSegmentM({ x: 5, y: 0, z: 3 }, a, b, metrics), 3)

  // Au-delà d'une extrémité — clampé à l'extrémité la plus proche, pas une droite infinie.
  assert.equal(distanceToSegmentM({ x: 15, y: 0, z: 0 }, a, b, metrics), 5)

  // Directement sur le segment (à l'intérieur de l'embrasure) → distance nulle.
  assert.equal(distanceToSegmentM({ x: 5, y: 0, z: 0 }, a, b, metrics), 0)

  // Altitude prise en compte (jamais ignorée) : un joueur horizontalement aligné mais à un étage
  // différent ne doit jamais paraître à 3m d'une porte à travers un plancher.
  assert.equal(distanceToSegmentM({ x: 5, y: 4, z: 3 }, a, b, metrics), 5)

  // Segment dégénéré (porte de longueur nulle, x0=x1/z0=z1) — ne doit pas produire NaN/division par 0.
  assert.equal(distanceToSegmentM({ x: 3, y: 0, z: 4 }, a, a, metrics), 5)
})
