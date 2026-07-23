import test from 'node:test'
import assert from 'node:assert/strict'

import { hasEnoughAmmo, weaponAmmoStatus } from './ammoRules.js'

test('tracking desactive (ammo_remaining null) laisse toujours tirer', () => {
  assert.equal(hasEnoughAmmo(null, 1), true)
  assert.equal(hasEnoughAmmo(undefined, 5), true)
})

test('PJ ou PNJ sans munition illimitee : bloque a 0', () => {
  assert.equal(hasEnoughAmmo(0, 1), false)
  assert.equal(hasEnoughAmmo(0, 1, { isPnj: true, pnjUnlimitedAmmo: false }), false)
})

test('quantite exacte suffit (>=), pas besoin de marge', () => {
  assert.equal(hasEnoughAmmo(2, 2), true)
  assert.equal(hasEnoughAmmo(1, 2), false)
})

test('PNJ + pnj_unlimited_ammo=true ignore le compteur', () => {
  assert.equal(hasEnoughAmmo(0, 1, { isPnj: true, pnjUnlimitedAmmo: true }), true)
})

test('bulletCount absent = 1 par defaut', () => {
  assert.equal(hasEnoughAmmo(0, undefined), false)
  assert.equal(hasEnoughAmmo(1, undefined), true)
})

test('COM28 - Matraque Mao (arme CaC sans calibre) : jamais de statut munitions', () => {
  assert.equal(weaponAmmoStatus(null, '40 (400)', null), null)
  assert.equal(weaponAmmoStatus(0, '40 (400)', undefined), null)
})

test('COM28 - arme a feu reelle : comportement inchange (empty/low/ok)', () => {
  assert.equal(weaponAmmoStatus(0, '15', '9mm'), 'empty')
  assert.equal(weaponAmmoStatus(3, '15', '9mm'), 'low')
  assert.equal(weaponAmmoStatus(10, '15', '9mm'), 'ok')
  assert.equal(weaponAmmoStatus(null, '15', '9mm'), 'empty')
})

test('COM28 - pas de capacite parseable : pas de statut', () => {
  assert.equal(weaponAmmoStatus(5, null, '9mm'), null)
  assert.equal(weaponAmmoStatus(5, 'variable', '9mm'), null)
})
