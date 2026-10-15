import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeSurfaceData, DEFAULT_SURFACE_DATA } from './surfaceCore.js'

// MAP-SCALE-NO-AUTHORITY — normalizeSurfaceData est une liste FERMÉE de clés (toute clé non listée
// disparaît à la sauvegarde) : metersPerCell doit survivre au round-trip, sans que ce module
// n'invente son propre défaut (l'autorité du défaut 1,5 m/case vit dans surfaceDocument.js).
test('normalizeSurfaceData préserve metersPerCell quand présent', () => {
  const result = normalizeSurfaceData({ ...DEFAULT_SURFACE_DATA, metersPerCell: 2 })
  assert.equal(result.metersPerCell, 2)
})

test('normalizeSurfaceData ne fabrique pas de metersPerCell quand absent (pas de défaut local)', () => {
  const result = normalizeSurfaceData({ ...DEFAULT_SURFACE_DATA })
  assert.equal(result.metersPerCell, undefined)
})

test('normalizeSurfaceData sur une entrée vide/invalide reste sans erreur (comportement inchangé)', () => {
  assert.equal(normalizeSurfaceData(null).metersPerCell, undefined)
  assert.equal(normalizeSurfaceData(undefined).metersPerCell, undefined)
})
