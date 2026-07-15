import test from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_SURFACE_MATERIAL_PRESET } from './proceduralMaterials.js'

test('les réglages d’apparence de surface sont neutres par défaut', () => {
  assert.equal(DEFAULT_SURFACE_MATERIAL_PRESET.wear, 0)
  assert.equal(DEFAULT_SURFACE_MATERIAL_PRESET.dirt, 0)
  assert.equal(DEFAULT_SURFACE_MATERIAL_PRESET.relief, 0)
})
