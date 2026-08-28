import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeMovementGait, selectMovementBudget, buildDroneAllures, MovementBudgetError } from './movementBudgetService.js'

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

test('un drone n’a qu’une allure : sa Vitesse (m/Tour) répliquée sur les 4 paliers', () => {
  assert.deepEqual(buildDroneAllures(30), { lente: 30, moyenne: 30, rapide: 30, max: 30 })
  // Vitesse en chaîne (payload/DB) — normalisée, jamais rejetée pour le type seul
  assert.deepEqual(buildDroneAllures('12'), { lente: 12, moyenne: 12, rapide: 12, max: 12 })
  // Drone explicitement immobile (RAW « Déplacement : - ») — 0 est valide, aucun déplacement ne sera
  // sélectionnable (selectCombatMovementForCost) mais pas une erreur de configuration
  assert.deepEqual(buildDroneAllures(0), { lente: 0, moyenne: 0, rapide: 0, max: 0 })
})

test('une Vitesse de drone non renseignée lève une MovementBudgetError avec un message clair', () => {
  for (const bad of [null, undefined, NaN, '', 'abc', -5]) {
    assert.throws(() => buildDroneAllures(bad), (err) => {
      assert.ok(err instanceof MovementBudgetError)
      assert.match(err.message, /Vitesse/)
      return true
    }, `attendu MovementBudgetError pour ${JSON.stringify(bad)}`)
  }
})
