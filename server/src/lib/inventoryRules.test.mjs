import test from 'node:test'
import assert from 'node:assert/strict'

import { isEquippableLocation, canStack } from './inventoryRules.js'

// Tests purs — aucune base. `canStack` (PLAN_USURE&INTEGRITE.md L1) est l'autorité serveur unique
// du « cet item peut-il partager une ligne d'inventaire (quantity > 1) ? », consommée par addItem /
// updateItem / buyFromMerchant / returnModToInventory.

test('isEquippableLocation — emplacement corporel/arme vs container vs absent', () => {
  assert.equal(isEquippableLocation('M'), true)
  assert.equal(isEquippableLocation('BG'), true)
  assert.equal(isEquippableLocation('D'), false)   // Sac : fournit un container, pas un emplacement
  assert.equal(isEquippableLocation('Ce'), false)  // Ceinture : idem
  assert.equal(isEquippableLocation(null), false)
})

test('canStack — false si équipable', () => {
  assert.equal(canStack({ location: 'M', has_integrity: false }), false)
  assert.equal(canStack({ location: 'BG', has_integrity: false }), false)
})

test('canStack — false si has_integrity (même non équipable)', () => {
  assert.equal(canStack({ location: null, has_integrity: true }), false)
  assert.equal(canStack({ location: 'D', has_integrity: true }), false)
})

test('canStack — true si ni équipable ni suivi en intégrité', () => {
  assert.equal(canStack({ location: null, has_integrity: false }), true)
  assert.equal(canStack({ location: 'D', has_integrity: false }), true)   // ordinateur rangé dans le Sac, non suivi
  assert.equal(canStack({ location: 'Ce', has_integrity: false }), true)
})

test('canStack — ref absent (item custom sans equipment_id) : stackable', () => {
  assert.equal(canStack(null), true)
  assert.equal(canStack(undefined), true)
  assert.equal(canStack({}), true)
})
