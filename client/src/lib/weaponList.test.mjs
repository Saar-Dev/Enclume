import test from 'node:test'
import assert from 'node:assert/strict'

import { buildWeaponList } from './weaponList.js'

// Jeux d'items minimaux — forme renvoyée par /char-sheet/:id/inventory + flattenItemsBySlot.
const scorpion = {
  id: 'w-scorpion', ref_name: 'Scorpion', slot: 'MD',
  ref_fire_mode: 'CC/RC', ref_caliber: '4L', ref_ammo_count: '24', ammo_remaining: 24,
  ref_damage_h: '3d10',
}
const bloom = {
  id: 'w-bloom', ref_name: 'Fusil Bloom', slot: '2M',
  ref_fire_mode: 'RC', ref_caliber: '5L', ref_ammo_count: '12', ammo_remaining: 3,
}
const congre = {
  id: 'w-congre', ref_name: 'Couteau Congre', custom_name: 'Congre de Baba',
  slots: ['MG'], ref_category: 'Arme de contact', ref_range: '0', ref_damage_h: '2d6',
}
const bayonet = { // arme mixte : tir + contact
  id: 'w-bayo', ref_name: 'Fusil-baïonnette', slots: ['2M'],
  ref_fire_mode: 'CC', ref_caliber: '4L', ref_ammo_count: '8', ammo_remaining: 8,
  ref_category: 'Arme de contact', ref_range: '1',
}

test('groupe les armes à feu en Distance et les armes de contact en Contact', () => {
  const { distance, contact } = buildWeaponList({
    rangedWeapons: [scorpion, bloom],
    meleeWeapons: [congre],
  })
  assert.deepEqual(distance.map(r => r.id), ['w-scorpion', 'w-bloom'])
  assert.equal(distance[0].group, 'distance')
  assert.equal(distance[0].kind, 'ranged')
  // Contact = arme de contact + mains nues permanente en dernier.
  assert.deepEqual(contact.map(r => r.id), ['w-congre', 'bare'])
  assert.equal(contact[0].name, 'Congre de Baba') // custom_name prioritaire
})

test('mains nues — ligne permanente, désactivable seulement par grisage transverse', () => {
  const { contact } = buildWeaponList({ meleeWeapons: [] })
  assert.equal(contact.length, 1)
  assert.equal(contact[0].id, 'bare')
  assert.equal(contact[0].kind, 'bare')
  assert.equal(contact[0].permanent, true)
  assert.equal(contact[0].name, null) // libellé i18n composé par le JSX
  assert.equal(contact[0].disabled, false)

  const off = buildWeaponList({ meleeWeapons: [], includeBareHands: false })
  assert.equal(off.contact.length, 0)
})

test('arme mixte (tir + contact) — présente dans les deux groupes, flag mixed', () => {
  const { distance, contact } = buildWeaponList({
    rangedWeapons: [bayonet],
    meleeWeapons: [bayonet],
  })
  assert.equal(distance.some(r => r.id === 'w-bayo'), true)
  assert.equal(contact.some(r => r.id === 'w-bayo'), true)
  assert.equal(distance.find(r => r.id === 'w-bayo').mixed, true)
  assert.equal(contact.find(r => r.id === 'w-bayo').mixed, true)
})

test('armes naturelles — après mains nues, kind natural, formule + agrippé', () => {
  const { contact } = buildWeaponList({
    meleeWeapons: [congre],
    naturalWeapons: [
      { id: 'm1', name: 'Griffes', natural_weapon_formula: '1d6+FOR/2', natural_weapon_requires_grapple: true },
    ],
  })
  assert.deepEqual(contact.map(r => r.id), ['w-congre', 'bare', 'nat:m1'])
  const claws = contact.at(-1)
  assert.equal(claws.kind, 'natural')
  assert.equal(claws.formula, '1d6+FOR/2')
  assert.equal(claws.requiresGrapple, true)
})

test('munitions — label "restant / capacité", statut low/empty', () => {
  const { distance } = buildWeaponList({ rangedWeapons: [scorpion, bloom] })
  assert.equal(distance[0].ammoLabel, '24 / 24')
  assert.equal(distance[0].ammoStatus, 'ok')
  assert.equal(distance[1].ammoLabel, '3 / 12')
  assert.equal(distance[1].ammoStatus, 'low')
})

test('arme à feu vide — grisée dans Distance seulement (ammoEmpty)', () => {
  const empty = { ...scorpion, ammo_remaining: 0 }
  const { distance } = buildWeaponList({ rangedWeapons: [empty] })
  assert.equal(distance[0].disabled, true)
  assert.equal(distance[0].disabledReason, 'ammoEmpty')
  assert.equal(distance[0].ammoStatus, 'empty')
})

test('grisage transverse — toute la liste grisée, raison propagée', () => {
  const { distance, contact } = buildWeaponList({
    rangedWeapons: [scorpion],
    meleeWeapons: [congre],
    naturalWeapons: [{ id: 'm1', name: 'Griffes', natural_weapon_formula: 'x' }],
    blanketDisable: 'mortallyWounded',
  })
  for (const row of [...distance, ...contact]) {
    assert.equal(row.disabled, true, `${row.id} devrait être grisé`)
    assert.equal(row.disabledReason, 'mortallyWounded')
  }
})

test('déduplication — un même id slotté deux fois (MG+MD) n\'apparaît qu\'une fois', () => {
  const twoHands = [{ ...congre, slot: 'MG' }, { ...congre, slot: 'MD' }]
  const { contact } = buildWeaponList({ meleeWeapons: twoHands })
  assert.deepEqual(contact.filter(r => r.id === 'w-congre').length, 1)
})

test('forme MJ (batch /combat-equipment) : `name` résolu + `inv_id` — le nom s\'affiche', () => {
  const gmScorpion = { id: 'e1', name: 'Scorpion', slot: 'MD', ref_fire_mode: 'CC', ref_caliber: '4L', ref_ammo_count: '24', ammo_remaining: 24 }
  const gmCouteau  = { id: 'e2', name: 'Couteau Congre', slot: 'MG', ref_category: 'Arme de contact', ref_range: '0' }
  const { distance, contact } = buildWeaponList({ rangedWeapons: [gmScorpion], meleeWeapons: [gmCouteau] })
  assert.equal(distance[0].name, 'Scorpion')
  assert.equal(contact[0].name, 'Couteau Congre')
  assert.deepEqual(contact.map(r => r.id), ['e2', 'bare'])   // couteau puis mains nues, pas 2× mains nues
})

test('entrée vide — ne jette pas, renvoie mains nues seule', () => {
  assert.deepEqual(buildWeaponList(), { distance: [], contact: [
    { id: 'bare', kind: 'bare', group: 'contact', name: null, slotLabel: null, fireMode: null,
      reachM: 0, damage: null, formula: null, requiresGrapple: false, ammoLabel: null,
      ammoStatus: null, mixed: false, permanent: true, disabled: false, disabledReason: null },
  ] })
})
