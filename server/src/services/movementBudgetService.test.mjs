import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeMovementGait, selectMovementBudget } from './movementBudgetService.js'

test('les alias d’allure sont normalisés sans laisser le client choisir un nombre libre', () => {
  assert.equal(normalizeMovementGait('normal'), 'moyenne')
  assert.equal(normalizeMovementGait('run'), 'rapide')
  assert.throws(() => normalizeMovementGait('teleport'))
})

test('le budget est sélectionné dans les allures calculées côté serveur', () => {
  assert.deepEqual(
    selectMovementBudget({ lente: 7.5, moyenne: 15, rapide: 30, max: 40 }, 'run'),
    { gait: 'rapide', budgetM: 30 },
  )
})
