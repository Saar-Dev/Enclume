import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_SURFACE_MATERIAL_PRESET,
  DEFAULT_PROCEDURAL_MATERIAL,
  makeProceduralMaterialDescriptor,
} from './proceduralMaterials.js'

test('les réglages d’apparence de surface sont neutres par défaut', () => {
  assert.equal(DEFAULT_SURFACE_MATERIAL_PRESET.wear, 0)
  assert.equal(DEFAULT_SURFACE_MATERIAL_PRESET.dirt, 0)
  assert.equal(DEFAULT_SURFACE_MATERIAL_PRESET.relief, 0)
  assert.equal(DEFAULT_SURFACE_MATERIAL_PRESET.patternScale, 1)
  assert.equal(DEFAULT_PROCEDURAL_MATERIAL.patternScale, 1)
})

// §18 PLAN_WORLD_BUILDER_REWORK.md — outil ÉCHELLE pour les motifs importés : `patternScale` doit
// retomber sur 1 (comportement historique, une seule répétition par tuile) pour toute salle/mur déjà
// en base qui n'a jamais connu ce champ, jamais sur une valeur qui casserait le rendu existant.
test('makeProceduralMaterialDescriptor — patternScale par défaut à 1 (rétrocompatibilité)', () => {
  assert.equal(makeProceduralMaterialDescriptor({}).patternScale, 1)
  assert.equal(makeProceduralMaterialDescriptor({ patternScale: undefined }).patternScale, 1)
})

test('makeProceduralMaterialDescriptor — patternScale invalide (0, négatif, NaN) retombe sur 1', () => {
  assert.equal(makeProceduralMaterialDescriptor({ patternScale: 0 }).patternScale, 1)
  assert.equal(makeProceduralMaterialDescriptor({ patternScale: -2 }).patternScale, 1)
  assert.equal(makeProceduralMaterialDescriptor({ patternScale: 'x' }).patternScale, 1)
})

test('makeProceduralMaterialDescriptor — patternScale valide est conservé', () => {
  assert.equal(makeProceduralMaterialDescriptor({ patternScale: 4 }).patternScale, 4)
  assert.equal(makeProceduralMaterialDescriptor({ patternScale: 0.25 }).patternScale, 0.25)
})
