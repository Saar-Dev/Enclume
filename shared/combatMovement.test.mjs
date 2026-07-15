import test from 'node:test'
import assert from 'node:assert/strict'

import {
  combatDestinationFromPayload,
  combatMovementFromActionKey,
  getCombatPathColor,
  selectCombatMovementForCost,
} from './combatMovement.js'

test('adapte les axes du payload de combat vers le repere monde', () => {
  assert.deepEqual(combatDestinationFromPayload({
    targetPosX: 4,
    targetPosY: 8,
    targetPosZ: 2.5,
  }), { x: 4, y: 2.5, z: 8 })
})

const allures = { lente: 5, moyenne: 15, rapide: 25, max: 45 }

test('le coût réel du chemin choisit la plus petite allure suffisante', () => {
  assert.deepEqual(
    selectCombatMovementForCost(15, allures),
    {
      gait: 'moyenne', actionKey: 'move_moyenne', initiativeModifier: -5,
      actionType: 'move_long', color: '#22c55e', costM: 15, budgetM: 15,
    },
  )
  assert.equal(selectCombatMovementForCost(45.01, allures), null)
})

test('couleur et action proviennent du même registre partagé', () => {
  assert.equal(getCombatPathColor(25, allures), '#f97316')
  assert.equal(combatMovementFromActionKey('move_rapide').gait, 'rapide')
})
