import test from 'node:test'
import assert from 'node:assert/strict'

import { createReliefBoxGeometry, isRealReliefProfile } from './reliefGeometry.js'

const RELIEF_PROFILE = {
  type: 'procedural-material',
  realRelief: true,
  relief: 50,
  material: 'steel',
  pattern: 'img_metal_rust',
}

test('isRealReliefProfile — vrai seulement si relief > 0 et realRelief !== false', () => {
  assert.equal(isRealReliefProfile(RELIEF_PROFILE), true)
  assert.equal(isRealReliefProfile({ ...RELIEF_PROFILE, relief: 0 }), false)
  assert.equal(isRealReliefProfile({ ...RELIEF_PROFILE, realRelief: false }), false)
  assert.equal(isRealReliefProfile(null), false)
})

test('createReliefBoxGeometry — sans relief actif, boîte standard non subdivisée', () => {
  const geometry = createReliefBoxGeometry({ width: 2, height: 1, depth: 2 })
  assert.equal(geometry.type, 'BoxGeometry')
})

// Chantier perf motifs (Saar, 2026-10-03) : le relief est desormais porte par le GPU
// (displacementMap sur le materiau, voir SurfaceDungeonScene.jsx) — la geometrie CPU ne doit
// plus jamais deplacer un sommet, meme quand une face porte un profil de relief actif. Avant ce
// chantier, cette meme assertion aurait echoue (les sommets de la face "top" auraient devie de
// ±0.12 unite autour de la hauteur reelle).
test('createReliefBoxGeometry — avec relief actif, les sommets restent exactement sur la boîte (relief porté par le GPU, pas par le CPU)', () => {
  const geometry = createReliefBoxGeometry({
    width: 3,
    height: 1,
    depth: 3,
    faceProfiles: [null, null, RELIEF_PROFILE, null, null, null],
    faceMask: [false, false, true, false, false, false],
    segmentsPerUnit: 4,
    maxSegments: 8,
  })

  assert.notEqual(geometry.type, 'BoxGeometry', 'la face relief doit être subdivisée (pas la BoxGeometry native)')

  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox
  assert.equal(max.y, 0.5, 'aucun sommet ne doit dépasser la hauteur réelle de la boîte')
  assert.equal(min.y, -0.5, 'aucun sommet ne doit s’enfoncer sous la hauteur réelle de la boîte')
  assert.equal(max.x, 1.5)
  assert.equal(min.x, -1.5)
  assert.equal(max.z, 1.5)
  assert.equal(min.z, -1.5)
})
