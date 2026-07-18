import test from 'node:test'
import assert from 'node:assert/strict'

import { isWeaponItem, resolveHandWeapons, flattenItemsBySlot } from './weaponSlots.js'

test('isWeaponItem — un Bouclier (ni fire_mode ni damage_h) n\'est pas une arme', () => {
  assert.equal(isWeaponItem({ ref_fire_mode: null, ref_damage_h: null }), false)
  assert.equal(isWeaponItem(null), false)
})

test('isWeaponItem — une arme de contact (damage_h seul) est une arme', () => {
  assert.equal(isWeaponItem({ ref_fire_mode: null, ref_damage_h: '1D10' }), true)
})

test('isWeaponItem — une arme à feu (fire_mode seul) est une arme', () => {
  assert.equal(isWeaponItem({ ref_fire_mode: 'CC/RC/RL', ref_damage_h: null }), true)
})

test('resolveHandWeapons — un deux-mains chargé (2M) est détecté comme primaryWeapon', () => {
  // Reproduit le cas réel Session 158 (Saar) — Loulou / Breather, slot '2M' seul.
  const rows = [{ slot: '2M', ref_fire_mode: 'CC/RC/RL', ref_damage_h: '4D10' }]
  const result = resolveHandWeapons(rows)
  assert.equal(result.primaryWeapon.slot, '2M')
  assert.equal(result.hasTwoWeapons, false)
})

test('resolveHandWeapons — un Bouclier en MG n\'écrase pas un pistolet en MD', () => {
  // Reproduit le cas réel Session 158 (Saar) — Mr Sourire / Bouclier+Scorpion.
  const rows = [
    { slot: 'MG', ref_fire_mode: null, ref_damage_h: null }, // Bouclier
    { slot: 'MD', ref_fire_mode: 'CC', ref_damage_h: '3D10' }, // Scorpion
  ]
  const result = resolveHandWeapons(rows)
  assert.equal(result.weaponMg, null)
  assert.equal(result.weaponMd.slot, 'MD')
  assert.equal(result.primaryWeapon.slot, 'MD')
})

test('resolveHandWeapons — une arme de contact seule (Matraque Mao) n\'est jamais confondue avec une arme à munitions', () => {
  const rows = [{ slot: 'MD', ref_fire_mode: null, ref_damage_h: '1D10' }]
  const result = resolveHandWeapons(rows)
  assert.equal(result.primaryWeapon.slot, 'MD')
  assert.equal(result.primaryWeapon.ref_fire_mode, null)
})

test('resolveHandWeapons — dual-wield MG+MD réel, sans 2M', () => {
  const rows = [
    { slot: 'MG', ref_fire_mode: 'CC', ref_damage_h: null },
    { slot: 'MD', ref_fire_mode: 'CC', ref_damage_h: null },
  ]
  const result = resolveHandWeapons(rows)
  assert.equal(result.hasTwoWeapons, true)
})

test('flattenItemsBySlot — un item multi-slots (slots: array) devient une ligne par slot de main', () => {
  const items = [
    { id: 'a', slots: ['2M'], ref_fire_mode: 'CC' },
    { id: 'b', slots: ['T', 'C'], ref_fire_mode: null }, // armure, hors slots de main
  ]
  const rows = flattenItemsBySlot(items)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].slot, '2M')
  assert.equal(rows[0].id, 'a')
})
