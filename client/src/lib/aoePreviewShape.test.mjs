import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildShotgunConeSpan, projectShotgunConeTriangles,
  buildConeSpan, projectConeTriangles,
  buildCircleSpan, projectCircleFan,
  buildGrenadeBlastRings, projectRingQuads, projectCircleOutline,
} from './aoePreviewShape.js'
import { GRENADE_FRAG_BANDS } from '../../../shared/combatRange.js'
import { createWorldMetrics } from '../../../shared/world/worldMetrics.js'
import { normalizeAoeShape, isPointInAoeShape } from '../../../shared/world/aoeShapes.js'

// ref_range réel du Klauss (seul fusil à pompe du catalogue, migrations/303_ref_equipment_seed.js) —
// même constante que shared/combatRange.test.mjs, pas une valeur inventée.
const KLAUSS_REF_RANGE = '2/7/14/28 (35)'
// ref_range + angleDeg réels du Lance-flammes (migrations 303 + 322_..._aoe_profile).
const LANCE_FLAMMES_REF_RANGE = '3/7/15/30 (40)'
const LANCE_FLAMMES_ANGLE = 30

function assertPointClose(actual, expected, label) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-9, `${label}.x : ${actual.x} ≈ ${expected.x}`)
  assert.ok(Math.abs(actual.z - expected.z) < 1e-9, `${label}.z : ${actual.z} ≈ ${expected.z}`)
}

// ─── Tronc de cône fusil à pompe — forme unique lue aussi par le serveur (resolveShotgunCone) ────────

test('buildShotgunConeSpan — Klauss : tronc de cône dérivé du tableau (1 m à 2 m, plafond 3 m dès 14 m, portée 35 m)', () => {
  const span = buildShotgunConeSpan(KLAUSS_REF_RANGE)
  assert.equal(span.startM, 2)
  assert.equal(span.capStartM, 14)
  assert.equal(span.capWidthM, 3)
  assert.equal(span.lengthM, 35)
  assert.ok(Math.abs(span.apexBackM - 4) < 1e-9)
})

test('buildShotgunConeSpan — portée non exploitable : null, jamais une exception', () => {
  assert.equal(buildShotgunConeSpan(null), null)
  assert.equal(buildShotgunConeSpan(''), null)
  assert.equal(buildShotgunConeSpan('100'), null)
})

test('projectShotgunConeTriangles — 0° : trapèze 1 m à 2 m → 3 m à 14 m, puis couloir 3 m jusqu’à 35 m (4 triangles)', () => {
  const tris = projectShotgunConeTriangles(buildShotgunConeSpan(KLAUSS_REF_RANGE), { x: 0, z: 0 }, 0)
  assert.equal(tris.length, 4)
  const has = (triangles, expected) => triangles.flatMap(t => t.corners).some(c => Math.abs(c.x - expected.x) < 1e-9 && Math.abs(c.z - expected.z) < 1e-9)
  const trapeze = tris.slice(0, 2)
  for (const e of [{ x: 2, z: 0.5 }, { x: 2, z: -0.5 }, { x: 14, z: 1.5 }, { x: 14, z: -1.5 }]) assert.ok(has(trapeze, e), `trapèze ${e.x},${e.z}`)
  const couloir = tris.slice(2)
  for (const e of [{ x: 14, z: 1.5 }, { x: 14, z: -1.5 }, { x: 35, z: 1.5 }, { x: 35, z: -1.5 }]) assert.ok(has(couloir, e), `couloir ${e.x},${e.z}`)
})

test('projectShotgunConeTriangles — 90° et origine décalée : mêmes distances, axes tournés', () => {
  const tris = projectShotgunConeTriangles(buildShotgunConeSpan(KLAUSS_REF_RANGE), { x: 10, z: 10 }, 90)
  const corners = tris.flatMap(t => t.corners)
  // bord proche (2 m devant, ±0,5 m) : (10 ∓ 0,5, 12) ; bord de plafond (14 m, ±1,5 m) : (10 ∓ 1,5, 24)
  for (const e of [{ x: 9.5, z: 12 }, { x: 10.5, z: 12 }, { x: 8.5, z: 24 }, { x: 11.5, z: 24 }]) {
    assert.ok(corners.some(c => Math.abs(c.x - e.x) < 1e-9 && Math.abs(c.z - e.z) < 1e-9), `coin ${e.x},${e.z}`)
  }
})

test('projectShotgunConeTriangles — span null : tableau vide, jamais une exception', () => {
  assert.deepEqual(projectShotgunConeTriangles(null, { x: 0, z: 0 }, 0), [])
})

// Parité aperçu ↔ résolution : le défaut d'origine était un aperçu différent de ce que le serveur touchait.
// Les bords du polygone dessiné doivent être la frontière exacte du test de touche (tronc de cône ∩ couloir
// plafonné), tel que le compose server/src/lib/aoeMechanisms/shotgunSpread.js.
test('parité — juste dedans / juste dehors du bord dessiné : touché / non touché par le serveur', () => {
  const M = createWorldMetrics({ metersPerCell: 1, worldUnitsPerCell: 1 })
  const span = buildShotgunConeSpan(KLAUSS_REF_RANGE)
  const origin = { x: 0, y: 0, z: 0 }
  const cone = normalizeAoeShape({ shape: 'cone', origin, directionDeg: 0, amplitudeM: span.lengthM, angleDeg: span.angleDeg, apexBackM: span.apexBackM })
  const capped = normalizeAoeShape({ shape: 'ray', origin, directionDeg: 0, amplitudeM: span.lengthM, widthM: span.capWidthM })
  const hit = pt => isPointInAoeShape(pt, cone, M) && isPointInAoeShape(pt, capped, M)
  const halfAt = d => Math.min((d + span.apexBackM) * Math.tan(span.angleDeg * Math.PI / 360), span.capWidthM / 2)
  for (const d of [2.5, 4, 7, 10, 14, 25, 34]) {
    const edge = halfAt(d)
    assert.ok(hit({ x: d, y: 0, z: edge - 0.01 }), `d=${d} juste dedans`)
    assert.ok(!hit({ x: d, y: 0, z: edge + 0.01 }), `d=${d} juste dehors`)
  }
  // les coins dessinés (0°) sont sur la frontière : légèrement rentrés vers le tireur → touchés
  for (const tri of projectShotgunConeTriangles(span, { x: 0, z: 0 }, 0)) {
    for (const c of tri.corners) {
      assert.ok(hit({ x: c.x * 0.999, y: 0, z: c.z * 0.999 }), `coin ${c.x},${c.z} rentré de 0,1 % : touché`)
    }
  }
})

// ─── Cône lance-flammes ───────────────────────────────────────────────────────────────────────────

test('buildConeSpan — Lance-flammes : rayon = portée extrême du catalogue (40 m), angle transmis', () => {
  assert.deepEqual(buildConeSpan(LANCE_FLAMMES_REF_RANGE, LANCE_FLAMMES_ANGLE), { lengthM: 40, angleDeg: 30 })
})

test('buildConeSpan — portée ou angle inexploitables : null, jamais une exception', () => {
  assert.equal(buildConeSpan(null, 30), null)
  assert.equal(buildConeSpan('', 30), null)
  assert.equal(buildConeSpan('pas un nombre', 30), null)
  assert.equal(buildConeSpan(LANCE_FLAMMES_REF_RANGE, 0), null)
  assert.equal(buildConeSpan(LANCE_FLAMMES_REF_RANGE, -10), null)
  assert.equal(buildConeSpan(LANCE_FLAMMES_REF_RANGE, 400), null)
  assert.equal(buildConeSpan(LANCE_FLAMMES_REF_RANGE, NaN), null)
})

test('projectConeTriangles — éventail contigu : apex commun, arête partagée entre triangles voisins', () => {
  const span = buildConeSpan(LANCE_FLAMMES_REF_RANGE, LANCE_FLAMMES_ANGLE)
  const tris = projectConeTriangles(span, { x: 0, z: 0 }, 0)
  assert.ok(tris.length >= 2)
  for (let i = 0; i < tris.length; i++) {
    assertPointClose(tris[i].corners[0], { x: 0, z: 0 }, `tri${i}.apex`)
    // extrémités sur le cercle de rayon lengthM
    for (const c of [tris[i].corners[1], tris[i].corners[2]]) {
      assert.ok(Math.abs(Math.hypot(c.x, c.z) - 40) < 1e-9, `tri${i} coin sur l'arc r=40`)
    }
    if (i > 0) assertPointClose(tris[i].corners[1], tris[i - 1].corners[2], `tri${i} arête partagée`)
  }
})

test('projectConeTriangles — 0° : arc centré sur +X, borné à ±15° pour un cône de 30°', () => {
  const span = buildConeSpan(LANCE_FLAMMES_REF_RANGE, LANCE_FLAMMES_ANGLE)
  const tris = projectConeTriangles(span, { x: 0, z: 0 }, 0)
  const first = tris[0].corners[1]
  const last = tris[tris.length - 1].corners[2]
  // -15° : (40 cos(-15°), 40 sin(-15°))
  assertPointClose(first, { x: 40 * Math.cos(-15 * Math.PI / 180), z: 40 * Math.sin(-15 * Math.PI / 180) }, 'bord -15°')
  assertPointClose(last,  { x: 40 * Math.cos( 15 * Math.PI / 180), z: 40 * Math.sin( 15 * Math.PI / 180) }, 'bord +15°')
})

test('projectConeTriangles — span null : tableau vide, jamais une exception', () => {
  assert.deepEqual(projectConeTriangles(null, { x: 0, z: 0 }, 0), [])
})

// ─── Cercle grenade ───────────────────────────────────────────────────────────────────────────────

test('buildCircleSpan — rayon exploitable → { radiusM } ; inexploitable → null, jamais une exception', () => {
  assert.deepEqual(buildCircleSpan(15), { radiusM: 15 })
  assert.equal(buildCircleSpan(0), null)
  assert.equal(buildCircleSpan(-3), null)
  assert.equal(buildCircleSpan(NaN), null)
  assert.equal(buildCircleSpan(null), null)
  assert.equal(buildCircleSpan('15'), null)
})

test('projectCircleFan — éventail fermé centré sur le POINT D\'IMPACT (pas le tireur), coins sur le cercle', () => {
  const center = { x: 10, z: -4 }
  const tris = projectCircleFan(buildCircleSpan(15), center, 48)
  assert.equal(tris.length, 48)
  for (let i = 0; i < tris.length; i++) {
    assertPointClose(tris[i].corners[0], center, `tri${i}.apex`)
    for (const c of [tris[i].corners[1], tris[i].corners[2]]) {
      assert.ok(Math.abs(Math.hypot(c.x - center.x, c.z - center.z) - 15) < 1e-9, `tri${i} coin sur le cercle r=15`)
    }
    // arête partagée avec le triangle voisin → éventail contigu, fermé sur 360°
    const next = tris[(i + 1) % tris.length]
    assertPointClose(tris[i].corners[2], next.corners[1], `tri${i} arête partagée`)
  }
})

test('projectCircleFan — nombre de facettes plancher à 8, span null → tableau vide', () => {
  assert.equal(projectCircleFan(buildCircleSpan(5), { x: 0, z: 0 }, 2).length, 8)
  assert.deepEqual(projectCircleFan(null, { x: 0, z: 0 }), [])
})

// ─── Anneaux de dégression grenade (§10.2) ────────────────────────────────────────────────────────

test('buildGrenadeBlastRings — un anneau par palier RAW, innerM chaîné sur le outerM précédent', () => {
  const rings = buildGrenadeBlastRings()
  assert.equal(rings.length, GRENADE_FRAG_BANDS.length)
  assert.deepEqual(rings.map(r => r.band), ['centre', 'courte', 'moyenne', 'longue', 'extreme'])
  assert.deepEqual(rings.map(r => r.innerM), [0, 1, 2.5, 5, 10])
  assert.deepEqual(rings.map(r => r.outerM), [1, 2.5, 5, 10, 15])
  for (let i = 1; i < rings.length; i++) {
    assert.equal(rings[i].innerM, rings[i - 1].outerM, `anneau ${i} contigu au précédent`)
  }
})

test('buildGrenadeBlastRings — opacité décroissante du centre vers l\'extrême (affichage : le regard va au danger)', () => {
  const op = buildGrenadeBlastRings().map(r => r.opacity)
  for (let i = 1; i < op.length; i++) assert.ok(op[i] < op[i - 1], `opacité ${i} < ${i - 1}`)
  assert.ok(op[0] > 0 && op[op.length - 1] > 0)
})

test('projectRingQuads — couronne : 4 coins par quad, sur les cercles innerM/outerM, centrée sur le point d\'impact', () => {
  const center = { x: 7, z: -2 }
  const ring = { band: 'moyenne', innerM: 2.5, outerM: 5, opacity: 0.25 }
  const quads = projectRingQuads(ring, center, 32)
  assert.equal(quads.length, 32)
  for (const q of quads) {
    assert.equal(q.corners.length, 4)
    const [innerA, outerA, outerB, innerB] = q.corners
    for (const c of [innerA, innerB]) assert.ok(Math.abs(Math.hypot(c.x - center.x, c.z - center.z) - 2.5) < 1e-9)
    for (const c of [outerA, outerB]) assert.ok(Math.abs(Math.hypot(c.x - center.x, c.z - center.z) - 5) < 1e-9)
  }
  // contiguïté angulaire : le coin externe d'un quad = le coin externe entrant du suivant
  for (let i = 0; i < quads.length; i++) {
    const next = quads[(i + 1) % quads.length]
    assertPointClose(quads[i].corners[2], next.corners[1], `quad${i} arête partagée (externe)`)
  }
})

test('projectRingQuads — palier centre (innerM 0) : quads dégénérés acceptés, coins internes au centre', () => {
  const center = { x: 0, z: 0 }
  const quads = projectRingQuads({ band: 'centre', innerM: 0, outerM: 1, opacity: 0.45 }, center, 16)
  assert.equal(quads.length, 16)
  for (const q of quads) {
    assertPointClose(q.corners[0], center, 'coin interne = centre')
    assertPointClose(q.corners[3], center, 'coin interne = centre')
  }
})

test('projectRingQuads — anneau invalide (outerM ≤ 0, innerM ≥ outerM, null) → tableau vide, jamais une exception', () => {
  assert.deepEqual(projectRingQuads(null, { x: 0, z: 0 }), [])
  assert.deepEqual(projectRingQuads({ innerM: 5, outerM: 5 }, { x: 0, z: 0 }), [])
  assert.deepEqual(projectRingQuads({ innerM: 8, outerM: 5 }, { x: 0, z: 0 }), [])
  assert.deepEqual(projectRingQuads({ innerM: 0, outerM: 0 }, { x: 0, z: 0 }), [])
})

test('projectCircleOutline — polyligne fermée sur le cercle du palier, premier = dernier point', () => {
  const center = { x: 3, z: 4 }
  const pts = projectCircleOutline(10, center, 24)
  assert.equal(pts.length, 25) // 24 facettes + point de fermeture
  for (const p of pts) assert.ok(Math.abs(Math.hypot(p.x - center.x, p.z - center.z) - 10) < 1e-9)
  assertPointClose(pts[0], pts[pts.length - 1], 'boucle fermée')
  assert.deepEqual(projectCircleOutline(0, center), [])
  assert.deepEqual(projectCircleOutline(NaN, center), [])
})
