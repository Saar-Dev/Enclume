import test from 'node:test'
import assert from 'node:assert/strict'

import { hasEnoughAmmo, weaponAmmoStatus, initialMagazineOnEquip, isCompatibleAmmoItem } from './ammoRules.js'

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

import { ammoMatchesWeapon } from './ammoRules.js'

test('ammoMatchesWeapon — même calibre uniquement', () => {
  assert.equal(ammoMatchesWeapon('5.56 mm', '5.56 mm'), true)
  assert.equal(ammoMatchesWeapon('5.56 mm', '5.56 mmS'), false)
  assert.equal(ammoMatchesWeapon('Charge électrique', 'Charge électrique'), true)
})

test('ammoMatchesWeapon — calibre absent : jamais compatible, même deux absents', () => {
  assert.equal(ammoMatchesWeapon(null, null), false)
  assert.equal(ammoMatchesWeapon(undefined, undefined), false)
  assert.equal(ammoMatchesWeapon('', ''), false)
  assert.equal(ammoMatchesWeapon('9 mm', null), false)
  assert.equal(ammoMatchesWeapon(null, '9 mm'), false)
})

// initialMagazineOnEquip — chargeur plein à la 1ʳᵉ mise en main (règle R16 de PLAN_PRISE_EN_MAIN.md) : MÊMES résultats que
// l'ancien corps de `inventoryService.resolveAmmoInit` (calibre présent, ammo_count parseable et > 0, sinon null).
test('initialMagazineOnEquip — arme à calibre : le chargeur plein, lu dans ammo_count (texte, ex. "45", "10 (2x)")', () => {
  assert.equal(initialMagazineOnEquip('3 mm', '45'), 45)
  assert.equal(initialMagazineOnEquip('5.56 mm', '30'), 30)
  assert.equal(initialMagazineOnEquip('9 mm', '10 (2x)'), 10)
  assert.equal(initialMagazineOnEquip('Charge électrique', '40'), 40)
  assert.equal(initialMagazineOnEquip('9 mm', 7), 7)
})

test('initialMagazineOnEquip — pas de suivi de chargeur : sans calibre (CaC, Choc), capacité absente, illisible ou nulle', () => {
  assert.equal(initialMagazineOnEquip(null, '45'), null)
  assert.equal(initialMagazineOnEquip(undefined, '45'), null)
  assert.equal(initialMagazineOnEquip('', '45'), null)
  assert.equal(initialMagazineOnEquip('9 mm', null), null)
  assert.equal(initialMagazineOnEquip('9 mm', undefined), null)
  assert.equal(initialMagazineOnEquip('9 mm', ''), null)
  assert.equal(initialMagazineOnEquip('9 mm', 'abc'), null)
  assert.equal(initialMagazineOnEquip('9 mm', '0'), null)
  assert.equal(initialMagazineOnEquip('9 mm', 0), null)
})

test('initialMagazineOnEquip — accord avec weaponAmmoStatus : la même condition « calibre + capacité » définit un chargeur suivi', () => {
  for (const [caliber, count] of [['3 mm', '45'], [null, '45'], ['9 mm', null], ['9 mm', '0'], ['9 mm', '10 (2x)']]) {
    assert.equal(initialMagazineOnEquip(caliber, count) !== null, weaponAmmoStatus(5, count, caliber) !== null, `${caliber} / ${count}`)
  }
})

test('isCompatibleAmmoItem — une munition du bon calibre, au Sac ou à la Ceinture : oui', () => {
  const ammo = { ref_family: 'Munitions', ref_caliber: '9 mm', container: 'Sac' }
  assert.equal(isCompatibleAmmoItem(ammo, '9 mm'), true)
  assert.equal(isCompatibleAmmoItem({ ...ammo, container: 'Ceinture' }, '9 mm'), true)
})

test('isCompatibleAmmoItem — une ARME rangée du même calibre n’est PAS une munition (armes et munitions portent toutes deux un calibre)', () => {
  const rangedGun = { ref_family: 'Armes', ref_caliber: '9 mm', container: 'Sac' }
  assert.equal(isCompatibleAmmoItem(rangedGun, '9 mm'), false)
})

test('isCompatibleAmmoItem — mauvais calibre, arme sans calibre, objet au Coffre, valeur absente : non', () => {
  const ammo = { ref_family: 'Munitions', ref_caliber: '9 mm', container: 'Sac' }
  assert.equal(isCompatibleAmmoItem(ammo, '5 mm'), false)
  assert.equal(isCompatibleAmmoItem(ammo, null), false)
  assert.equal(isCompatibleAmmoItem({ ...ammo, container: 'Coffre' }, '9 mm'), false)
  assert.equal(isCompatibleAmmoItem(null, '9 mm'), false)
  assert.equal(isCompatibleAmmoItem({ ref_family: 'Munitions', container: 'Sac' }, '9 mm'), false)
})
