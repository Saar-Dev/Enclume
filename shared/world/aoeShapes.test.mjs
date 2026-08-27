import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorldMetrics, DEFAULT_WORLD_METRICS } from './worldMetrics.js'
import { normalizeAoeShape, isPointInAoeShape, resolveScatter } from './aoeShapes.js'

// Métrique 1 unité monde = 1 mètre : coordonnées de test lisibles directement en mètres. La conversion
// réelle (1 unité = 1,5 m, DEFAULT_WORLD_METRICS) est vérifiée séparément plus bas, pour ne jamais
// laisser un test « juste parce que » la métrique était neutre.
const metrics = createWorldMetrics({ metersPerCell: 1, worldUnitsPerCell: 1 })
const origin = { x: 0, y: 0, z: 0 }

test('cercle — inclut le centre et le rayon, exclut au-delà', () => {
  const shape = normalizeAoeShape({ shape: 'circle', origin, amplitudeM: 5 })
  assert.equal(isPointInAoeShape({ x: 0, y: 0, z: 0 }, shape, metrics), true)
  assert.equal(isPointInAoeShape({ x: 5, y: 0, z: 0 }, shape, metrics), true)
  assert.equal(isPointInAoeShape({ x: 5.01, y: 0, z: 0 }, shape, metrics), false)
  // la hauteur n'intervient jamais dans la couche 1 (couverte séparément par la LOS)
  assert.equal(isPointInAoeShape({ x: 3, y: 999, z: 0 }, shape, metrics), true)
})

test('cône — respecte la portée ET l’angle, jamais l’un sans l’autre', () => {
  const shape = normalizeAoeShape({
    shape: 'cone', origin, amplitudeM: 10, directionDeg: 0, angleDeg: 90,
  })
  assert.equal(isPointInAoeShape({ x: 5, y: 0, z: 0 }, shape, metrics), true, 'dans l’axe, à portée')
  assert.equal(isPointInAoeShape({ x: 5, y: 0, z: 5 }, shape, metrics), true, 'à 45°, dans le demi-angle de 45°')
  assert.equal(isPointInAoeShape({ x: 0, y: 0, z: 5 }, shape, metrics), false, 'à 90°, hors du demi-angle')
  assert.equal(isPointInAoeShape({ x: 20, y: 0, z: 0 }, shape, metrics), false, 'dans l’axe mais hors de portée')
  assert.equal(isPointInAoeShape(origin, shape, metrics), true, 'l’origine est toujours dans son propre cône')
})

test('cône à 360° — équivalent à un cercle', () => {
  const shape = normalizeAoeShape({
    shape: 'cone', origin, amplitudeM: 5, directionDeg: 0, angleDeg: 360,
  })
  for (const point of [{ x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: -5 }, { x: -3, y: 0, z: 4 }]) {
    assert.equal(isPointInAoeShape(point, shape, metrics), true)
  }
})

test('rayon — couloir rectangulaire, borné en longueur et en largeur', () => {
  const shape = normalizeAoeShape({
    shape: 'ray', origin, amplitudeM: 10, directionDeg: 0, widthM: 3,
  })
  assert.equal(isPointInAoeShape({ x: 5, y: 0, z: 1.4 }, shape, metrics), true, 'dans le couloir')
  assert.equal(isPointInAoeShape({ x: 5, y: 0, z: 1.6 }, shape, metrics), false, 'hors largeur')
  assert.equal(isPointInAoeShape({ x: 10, y: 0, z: 0 }, shape, metrics), true, 'à la longueur exacte')
  assert.equal(isPointInAoeShape({ x: 10.1, y: 0, z: 0 }, shape, metrics), false, 'au-delà de la longueur')
  assert.equal(isPointInAoeShape({ x: -0.1, y: 0, z: 0 }, shape, metrics), false, 'derrière l’origine')
})

test('cercle — la conversion mètres/unités monde est réellement appliquée (pas 1:1 par accident)', () => {
  // DEFAULT_WORLD_METRICS : 1 unité monde = 1,5 m → un rayon de 5 m vaut 5/1,5 ≈ 3,333 unités monde.
  const shape = normalizeAoeShape({ shape: 'circle', origin, amplitudeM: 5 })
  assert.equal(isPointInAoeShape({ x: 3.33, y: 0, z: 0 }, shape, DEFAULT_WORLD_METRICS), true, 'dans le rayon converti')
  assert.equal(isPointInAoeShape({ x: 3.34, y: 0, z: 0 }, shape, DEFAULT_WORLD_METRICS), false, 'juste au-delà du rayon converti')
  // Avec la métrique 1:1 du reste du fichier, ces mêmes coordonnées seraient dans les deux cas trop courtes pour rien dire.
})

test('normalizeAoeShape refuse les paramètres invalides plutôt que de propager une figure fausse', () => {
  assert.throws(() => normalizeAoeShape({ shape: 'triangle', origin, amplitudeM: 1 }), /forme AOE inconnue/)
  assert.throws(() => normalizeAoeShape({ shape: 'circle', origin, amplitudeM: 0 }), /strictement positif/)
  assert.throws(() => normalizeAoeShape({ shape: 'circle', origin, amplitudeM: -1 }), /strictement positif/)
  assert.throws(
    () => normalizeAoeShape({ shape: 'cone', origin, amplitudeM: 5, directionDeg: 0, angleDeg: 400 }),
    /ne peut pas dépasser 360/,
  )
})

test('dispersion — sans échec, le point d’impact ne bouge pas', () => {
  const intendedOrigin = { x: 10, y: 0, z: 0 }
  const result = resolveScatter({
    throwerPosition: origin, intendedOrigin, failureMarginM: 0, d6Roll: 1,
  }, metrics)
  assert.deepEqual(result, intendedOrigin)
})

test('dispersion — 1D6=1 (surshoot) éloigne encore plus le point d’impact du lanceur', () => {
  const intendedOrigin = { x: 10, y: 0, z: 0 }
  const result = resolveScatter({
    throwerPosition: origin, intendedOrigin, failureMarginM: 3, d6Roll: 1,
  }, metrics)
  // world units : metersPerCell 1.5 / worldUnitsPerCell 1 → 1 m = 1/1.5 unité monde
  assert.ok(result.x > intendedOrigin.x, 'continue au-delà du point visé, dans l’axe du jet')
  assert.equal(result.y, intendedOrigin.y)
})

test('dispersion — 1D6=4 (undershoot) ramène le point d’impact vers le lanceur', () => {
  const intendedOrigin = { x: 10, y: 0, z: 0 }
  const result = resolveScatter({
    throwerPosition: origin, intendedOrigin, failureMarginM: 3, d6Roll: 4,
  }, metrics)
  assert.ok(result.x < intendedOrigin.x, 'tombe en-deçà du point visé, vers le lanceur')
})

test('dispersion — refuse un d6Roll hors de [1,6]', () => {
  const intendedOrigin = { x: 10, y: 0, z: 0 }
  assert.throws(
    () => resolveScatter({ throwerPosition: origin, intendedOrigin, failureMarginM: 3, d6Roll: 7 }, metrics),
    /entier entre 1 et 6/,
  )
})
