import test from 'node:test'
import assert from 'node:assert/strict'

import { buildShotgunSpreadSegments, projectShotgunSpreadCorners } from './aoePreviewShape.js'

// ref_range réel du Klauss (seul fusil à pompe du catalogue, migrations/303_ref_equipment_seed.js) —
// même constante que shared/combatRange.test.mjs, pas une valeur inventée.
const KLAUSS_REF_RANGE = '2/7/14/28 (35)'

test('Klauss : 4 segments (bout_portant exclu), largeurs et bornes RAW exactes', () => {
  const segments = buildShotgunSpreadSegments(KLAUSS_REF_RANGE)
  assert.deepEqual(segments, [
    { band: 'courte',  fromM: 2,  toM: 7,  widthM: 1 },
    { band: 'moyenne', fromM: 7,  toM: 14, widthM: 2 },
    { band: 'longue',  fromM: 14, toM: 28, widthM: 3 },
    { band: 'extreme', fromM: 28, toM: 35, widthM: 3 },
  ])
})

test('segments contigus : le toM d\'une bande est le fromM de la suivante (aucun trou ni recouvrement)', () => {
  const segments = buildShotgunSpreadSegments(KLAUSS_REF_RANGE)
  for (let i = 1; i < segments.length; i++) {
    assert.equal(segments[i].fromM, segments[i - 1].toM)
  }
})

test('portée non exploitable : tableau vide, jamais une exception', () => {
  assert.deepEqual(buildShotgunSpreadSegments(null), [])
  assert.deepEqual(buildShotgunSpreadSegments(''), [])
  assert.deepEqual(buildShotgunSpreadSegments('pas un nombre'), [])
})

test('portée unique (dégénérée) : un seul segment extrême couvrant toute la portée', () => {
  const segments = buildShotgunSpreadSegments('100')
  assert.deepEqual(segments, [
    { band: 'extreme', fromM: 0, toM: 100, widthM: 3 },
  ])
})

// ─── projectShotgunSpreadCorners — même convention que shared/world/aoeShapes.js (0° = +X, trigo → +Z) ──

function assertPointClose(actual, expected, label) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-9, `${label}.x : ${actual.x} ≈ ${expected.x}`)
  assert.ok(Math.abs(actual.z - expected.z) < 1e-9, `${label}.z : ${actual.z} ≈ ${expected.z}`)
}

test('projectShotgunSpreadCorners — 0° : couloir aligné sur +X, largeur sur Z', () => {
  const [quad] = projectShotgunSpreadCorners(
    [{ band: 'courte', fromM: 2, toM: 7, widthM: 1 }],
    { x: 0, z: 0 }, 0,
  )
  assert.equal(quad.band, 'courte')
  assertPointClose(quad.corners[0], { x: 2, z: 0.5 },  'corner0')
  assertPointClose(quad.corners[1], { x: 2, z: -0.5 }, 'corner1')
  assertPointClose(quad.corners[2], { x: 7, z: -0.5 }, 'corner2')
  assertPointClose(quad.corners[3], { x: 7, z: 0.5 },  'corner3')
})

test('projectShotgunSpreadCorners — 90° : couloir aligné sur +Z, largeur sur X, origine décalée', () => {
  const [quad] = projectShotgunSpreadCorners(
    [{ band: 'courte', fromM: 2, toM: 7, widthM: 1 }],
    { x: 10, z: 10 }, 90,
  )
  assertPointClose(quad.corners[0], { x: 9.5,  z: 12 }, 'corner0')
  assertPointClose(quad.corners[1], { x: 10.5, z: 12 }, 'corner1')
  assertPointClose(quad.corners[2], { x: 10.5, z: 17 }, 'corner2')
  assertPointClose(quad.corners[3], { x: 9.5,  z: 17 }, 'corner3')
})

test('projectShotgunSpreadCorners — un quad par segment, même ordre', () => {
  const quads = projectShotgunSpreadCorners(buildShotgunSpreadSegments(KLAUSS_REF_RANGE), { x: 0, z: 0 }, 0)
  assert.deepEqual(quads.map(q => q.band), ['courte', 'moyenne', 'longue', 'extreme'])
})
