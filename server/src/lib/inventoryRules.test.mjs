import test from 'node:test'
import assert from 'node:assert/strict'

import { isEquippableLocation, canStack } from './inventoryRules.js'

// Tests purs — aucune base. `canStack` (PLAN_USURE&INTEGRITE.md L1, généralisé GRENADE-STACK-BY-TYPE
// 2026-10-06) est l'autorité serveur unique du « cet item peut-il partager une ligne d'inventaire
// (quantity > 1) ? », consommée par addItem / updateItem / buyFromMerchant / returnModToInventory.
// Patron « définition vs instance » des inventaires de jeu (durabilité/charges = jamais stackable,
// FoundryVTT dnd5e) : deux données réellement propres à un exemplaire comptent — `has_integrity`
// (ITG) et un chargeur suivi (`caliber` + tenu en main, même garde que `resolveAmmoInit`/
// `ammoRules.js#weaponAmmoStatus` : une MUNITION porte aussi un `caliber`, le sien, sans jamais
// recevoir de chargeur propre).

test('isEquippableLocation — emplacement corporel/arme vs container vs absent', () => {
  assert.equal(isEquippableLocation('M'), true)
  assert.equal(isEquippableLocation('BG'), true)
  assert.equal(isEquippableLocation('D'), false)   // Sac : fournit un container, pas un emplacement
  assert.equal(isEquippableLocation('Ce'), false)  // Ceinture : idem
  assert.equal(isEquippableLocation(null), false)
})

test('canStack — false si has_integrity, peu importe le reste', () => {
  assert.equal(canStack({ has_integrity: true, caliber: null, location: null }), false)
  assert.equal(canStack({ has_integrity: true, caliber: '9mm', location: 'M' }), false)
})

test('canStack — false si caliber ET tenu en main (chargeur réellement chargeable, resolveAmmoInit)', () => {
  assert.equal(canStack({ has_integrity: false, caliber: '9mm', location: 'M' }), false)
  assert.equal(canStack({ has_integrity: false, caliber: '9mm', location: '2M' }), false)
})

test('canStack — caliber SANS emplacement corporel (la munition porte son propre caliber) : stackable', () => {
  // Cas réel vérifié en base (non-régression trouvée en testant) : les 121 munitions du catalogue
  // ont toutes un caliber (le leur) et location=NULL — jamais un chargeur qui leur est propre.
  assert.equal(canStack({ has_integrity: false, caliber: '9mm', location: null }), true)
  assert.equal(canStack({ has_integrity: false, caliber: '9mm', location: 'D' }), true)
})

test('canStack — ni Intégrité ni caliber : stackable, équipable ou pas', () => {
  assert.equal(canStack({ has_integrity: false, caliber: null, location: 'M', category: 'Grenade' }), true)
  assert.equal(canStack({ has_integrity: false, caliber: null, location: 'M', category: 'Armes de jet' }), true)
  // Arme de corps à corps basique ou armure simple de bas niveau technologique (données réelles,
  // vérifiées en base le 2026-10-06) : même règle, sans liste de catégories à tenir à jour.
  assert.equal(canStack({ has_integrity: false, caliber: null, location: 'M', category: 'Arme de contact' }), true)
  assert.equal(canStack({ has_integrity: false, caliber: null, location: 'T/C/B/J', category: 'Tenue' }), true)
  assert.equal(canStack({ has_integrity: false, caliber: null, location: null }), true)   // ordinateur rangé, non suivi
  assert.equal(canStack({ has_integrity: false, caliber: null, location: 'D' }), true)
})

test('canStack — arc/arbalète/fronde primitifs (fire_mode posé mais caliber NULL) : stackables', () => {
  // Cas réel vérifié en base : ces 3 armes ont has_integrity=false ET caliber=NULL — aucune des deux
  // conditions de blocage ne s'applique, contrairement à une arme à feu normale (caliber non NULL).
  assert.equal(canStack({ has_integrity: false, caliber: null, location: '2M' }), true)
})

test('canStack — ref absent (item custom sans equipment_id) : stackable', () => {
  assert.equal(canStack(null), true)
  assert.equal(canStack(undefined), true)
  assert.equal(canStack({}), true)
})
