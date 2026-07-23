import test from 'node:test'
import assert from 'node:assert/strict'

import { isWeaponItem, resolveHandWeapons, flattenItemsBySlot, handSlotDisplayRows } from './weaponSlots.js'

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

test('isWeaponItem — une arme Choc pur (shock seul, ni fire_mode ni damage_h) est une arme', () => {
  // Reproduit le bug réel CHOC1 (Saar) : la Dague neurale (ref_damage_h null, ref_shock '3D10')
  // disparaissait de la détection côté MJ (CombatGmDeclareWindow → /combat-equipment).
  assert.equal(isWeaponItem({ ref_fire_mode: null, ref_damage_h: null, ref_shock: '3D10' }), true)
})

test('resolveHandWeapons — une arme Choc pur seule (Dague neurale) est détectée comme primaryWeapon', () => {
  const rows = [{ slot: 'MD', ref_fire_mode: null, ref_damage_h: null, ref_shock: '3D10' }]
  const result = resolveHandWeapons(rows)
  assert.equal(result.primaryWeapon.slot, 'MD')
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

test('handSlotDisplayRows — MG seul : une ligne, pas de préfixe', () => {
  const { rows, showSlotLabel } = handSlotDisplayRows({ MG: { name: 'Scorpion' } })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].slot, 'MG')
  assert.equal(showSlotLabel, false)
})

test('handSlotDisplayRows — MG+MD : deux lignes dans l\'ordre, préfixe requis', () => {
  const { rows, showSlotLabel } = handSlotDisplayRows({ MG: { name: 'A' }, MD: { name: 'B' } })
  assert.deepEqual(rows.map(r => r.slot), ['MG', 'MD'])
  assert.equal(showSlotLabel, true)
})

test('handSlotDisplayRows — 2M seul (COM2) : une ligne visible avec préfixe', () => {
  // Reproduit le bug réel : côté MJ, weaponMg/weaponMd valent tous deux null pour un PNJ en 2M seul —
  // sans ce cas géré explicitement, le bloc ARMEMENT entier disparaissait (COM2).
  const { rows, showSlotLabel } = handSlotDisplayRows({ MG: null, MD: null, '2M': { name: 'Fusil à pompe' } })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].slot, '2M')
  assert.equal(showSlotLabel, true)
})

test('handSlotDisplayRows — Tr seul (arme montée) : une ligne visible avec préfixe', () => {
  const { rows, showSlotLabel } = handSlotDisplayRows({ Tr: { name: 'Mitrailleuse lourde' } })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].slot, 'Tr')
  assert.equal(showSlotLabel, true)
})

test('handSlotDisplayRows — aucune arme en main : tableau vide', () => {
  const { rows, showSlotLabel } = handSlotDisplayRows({})
  assert.equal(rows.length, 0)
  assert.equal(showSlotLabel, false)
})
