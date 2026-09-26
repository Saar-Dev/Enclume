import test from 'node:test'
import assert from 'node:assert/strict'

import { MAP_LIMITS } from './mapLimits.js'

// Les noms sont le contrat des consommateurs (garde structurelle, enveloppe, export, import) : en retirer un
// doit faire échouer ce test, pas casser silencieusement un plafond.
const EXPECTED_KEYS = [
  'maxAbsCoordinate', 'maxCeilings', 'maxConnectors', 'maxErrors', 'maxExtentCells', 'maxFileBytes',
  'maxFloors', 'maxJsonDepth', 'maxJsonNodes', 'maxKeyLength', 'maxNameLength', 'maxRingPoints',
  'maxRooms', 'maxStairs', 'maxStringLength', 'maxTotalCells', 'maxVerticalSlices', 'maxWalls',
]

test('MAP_LIMITS expose exactement les plafonds attendus', () => {
  assert.deepEqual(Object.keys(MAP_LIMITS).sort(), EXPECTED_KEYS)
})

test('MAP_LIMITS est gelé : un consommateur ne peut pas relâcher un plafond', () => {
  assert.equal(Object.isFrozen(MAP_LIMITS), true)
  // Un module ES est en mode strict : écrire dans un objet gelé lève une TypeError.
  assert.throws(() => { MAP_LIMITS.maxRooms = 1e9 }, TypeError)
})

test('chaque plafond est un entier strictement positif', () => {
  for (const [name, value] of Object.entries(MAP_LIMITS)) {
    assert.ok(Number.isInteger(value) && value > 0, `${name} doit être un entier > 0 (reçu ${value})`)
  }
})

test('les plafonds sont cohérents entre eux', () => {
  assert.ok(MAP_LIMITS.maxTotalCells <= MAP_LIMITS.maxExtentCells ** 2,
    'la surface totale ne peut pas dépasser l\'étendue au carré')
  assert.ok(MAP_LIMITS.maxAbsCoordinate >= MAP_LIMITS.maxExtentCells,
    'une carte de la taille maximale doit pouvoir être décalée par rapport à l\'origine')
  assert.ok(MAP_LIMITS.maxNameLength <= MAP_LIMITS.maxStringLength)
  assert.ok(MAP_LIMITS.maxKeyLength <= MAP_LIMITS.maxStringLength)
  assert.ok(MAP_LIMITS.maxErrors >= 1)
})
