import test from 'node:test'
import assert from 'node:assert/strict'

import { pnjHandEquipment } from './pnjHandEquipment.js'
import { applyDeclaredSwap } from './declaredSwap.js'

// PLAN_PRISE_EN_MAIN.md, Lot C — les armes en main d'un PNJ, dérivées de son inventaire (mêmes règles que la route
// `combat-equipment` : `resolveHandWeapons`), avec la forme que la fenêtre MJ lit déjà (`inv_id`, `name`, `slot`).

const line = (id, extra = {}) => ({
  id, container: 'Sac', slots: null, quantity: 1, ref_location: 'M', ref_weight: null, ref_capacity: null,
  ref_name: `Nom ${id}`, custom_name: null, ref_category: 'Armes de poing', ref_fire_mode: null, ref_damage_h: null, ref_shock: null,
  ...extra,
})
const SAC = line('sac', { slots: ['D'], ref_location: 'D', ref_capacity: 20 })
const CEINTURE = line('ceinture', { slots: ['Ce'], ref_location: 'Ce', ref_capacity: 3 })

test('pnjHandEquipment — aucune arme en main : tout à null, jamais une exception', () => {
  assert.deepEqual(pnjHandEquipment([SAC, CEINTURE, line('rangee', { ref_fire_mode: 'CC' })]),
    { weapon: null, weaponMg: null, weaponMd: null, weapon2M: null, weaponTr: null })
  assert.deepEqual(pnjHandEquipment([]).weapon, null)
  assert.deepEqual(pnjHandEquipment(undefined).weapon, null)
})

test('pnjHandEquipment — une arme en main : même forme que la route (inv_id, name, slot), principale = elle', () => {
  const { weapon, weaponMd, weaponMg } = pnjHandEquipment([SAC, line('gun', { slots: ['MD'], ref_fire_mode: 'CC/RC', ref_name: 'Scorpion' })])
  assert.equal(weapon.inv_id, 'gun')
  assert.equal(weapon.id, 'gun')
  assert.equal(weapon.name, 'Scorpion')
  assert.equal(weapon.slot, 'MD')
  assert.equal(weaponMd, weapon)
  assert.equal(weaponMg, null)
})

test('pnjHandEquipment — deux armes : la main directrice (MD) prime ; le deux-mains prime sur tout', () => {
  const two = pnjHandEquipment([line('l', { slots: ['MG'], ref_fire_mode: 'CC' }), line('r', { slots: ['MD'], ref_fire_mode: 'CC' })])
  assert.equal(two.weapon.inv_id, 'r')
  assert.equal(two.weaponMg.inv_id, 'l')
  const heavy = pnjHandEquipment([line('rifle', { slots: ['2M'], ref_location: '2M', ref_fire_mode: 'CC' })])
  assert.equal(heavy.weapon.inv_id, 'rifle')
  assert.equal(heavy.weapon2M.slot, '2M')
})

test('pnjHandEquipment — un bouclier en main n’est pas une arme (comme la route) ; une arme de contact l’est', () => {
  const { weapon, weaponMg, weaponMd } = pnjHandEquipment([
    line('shield', { slots: ['BG', 'C', 'MG'], ref_category: 'Bouclier' }),
    line('knife', { slots: ['MD'], ref_category: 'Arme de contact', ref_damage_h: '1D6' }),
  ])
  assert.equal(weaponMg, null)
  assert.equal(weaponMd.inv_id, 'knife')
  assert.equal(weapon.inv_id, 'knife')
})

test('pnjHandEquipment — après une permutation choisie : la grenade est l’arme en main, l’arme remplacée n’y est plus (l’aperçu du MJ)', () => {
  const items = [SAC, CEINTURE,
    line('scorpion', { slots: ['MD'], ref_fire_mode: 'CC/RC', ref_name: 'Scorpion' }),
    line('frag', { container: 'Ceinture', ref_name: 'Grenade à fragmentation', ref_damage_h: '4D10', ref_aoe_profile: { shape: 'circle', radiusM: 15, mechanic: 'grenade_frag' } })]
  const before = pnjHandEquipment(items)
  assert.equal(before.weapon.inv_id, 'scorpion')
  const after = pnjHandEquipment(applyDeclaredSwap(items, { itemId: 'frag', replaceItemId: 'scorpion' }).items)
  assert.equal(after.weapon.inv_id, 'frag')
  assert.equal(after.weaponMd.name, 'Grenade à fragmentation')
  assert.equal(after.weaponMg, null)
})
