import test from 'node:test'
import assert from 'node:assert/strict'

import { applyDeclaredSwap, swapWarning, heldItemsWithoutActionRow } from './declaredSwap.js'
import { GRAB_REFUSAL } from '../../../shared/combatGrabItem.js'
import { weaponHasRangedAttackPath } from '../../../shared/combatAoe.js'
import { flattenItemsBySlot } from '../../../shared/weaponSlots.js'
import { isCompatibleAmmoItem } from '../../../shared/ammoRules.js'

// PLAN_PRISE_EN_MAIN.md, Lot B1 — l'aperçu de « Permuter » côté fenêtre de déclaration. La DÉCISION est `decideHandSwap`
// (shared/, testée dans combatGrabDecision.test.mjs) : ici, sa PROJECTION sur la liste d'objets affichée et les avertissements.

const line = (id, extra = {}) => ({
  id, container: 'Sac', slots: null, quantity: 1, ref_location: 'M', ref_weight: null, ref_capacity: null,
  ref_name: id, custom_name: null, ref_caliber: null, ref_ammo_count: null, ammo_remaining: null, ref_family: 'Armes', ...extra,
})
const SAC = line('sac', { slots: ['D'], ref_location: 'D', ref_capacity: 20 })
const CEINTURE = line('ceinture', { slots: ['Ce'], ref_location: 'Ce', ref_capacity: 3 })
const byId = (items, id) => items.find(item => item.id === id)

// ─── applyDeclaredSwap ───────────────────────────────────────────────────────────────────────────────────────────────

test('applyDeclaredSwap — sans permutation : l’inventaire de base, MÊME référence (identité stable pour useMemo)', () => {
  const items = [SAC, CEINTURE, line('gun', { slots: ['MD'] })]
  const result = applyDeclaredSwap(items, null)
  assert.equal(result.items, items)
  assert.equal(result.decision, null)
  assert.equal(applyDeclaredSwap(items, { itemId: null, replaceItemId: null }).items, items)
})

test('applyDeclaredSwap — « Mains nues » : l’entrant est en main (MD), rien d’autre ne bouge', () => {
  const items = [SAC, CEINTURE, line('gren', { container: 'Ceinture', ref_weight: 0.3 })]
  const { items: effective, decision } = applyDeclaredSwap(items, { itemId: 'gren', replaceItemId: null })
  assert.equal(decision.status, 'planned')
  assert.deepEqual(byId(effective, 'gren').slots, ['MD'])
  assert.equal(byId(effective, 'gren').container, 'Sac') // équiper en main force le conteneur, comme applyItemUpdate
  assert.equal(byId(effective, 'sac'), SAC)
})

test('applyDeclaredSwap — remplacement : la ligne cliquée est rangée (slots NULL, pas []), l’entrant prend SA main', () => {
  const items = [SAC, CEINTURE, line('pistol', { slots: ['MG'], ref_weight: 1 }), line('gren', { container: 'Ceinture', ref_weight: 0.3 })]
  const { items: effective } = applyDeclaredSwap(items, { itemId: 'gren', replaceItemId: 'pistol' })
  assert.deepEqual(byId(effective, 'gren').slots, ['MG'])
  assert.equal(byId(effective, 'pistol').slots, null) // la convention du serveur : les filtres (`slots == null`) en dépendent
  assert.equal(byId(effective, 'pistol').container, 'Ceinture') // conteneur d'origine de l'entrant (R4)
})

test('applyDeclaredSwap — ne modifie jamais l’inventaire de base (aperçu réversible jusqu’à confirmation serveur)', () => {
  const items = Object.freeze([SAC, CEINTURE, line('pistol', { slots: ['MG'] }), line('gren', { container: 'Ceinture' })].map(Object.freeze))
  const { items: effective } = applyDeclaredSwap(items, { itemId: 'gren', replaceItemId: 'pistol' })
  assert.notEqual(effective, items)
  assert.deepEqual(byId(items, 'pistol').slots, ['MG'])
  assert.equal(byId(items, 'gren').container, 'Ceinture')
})

test('applyDeclaredSwap — R16 : une arme à calibre jamais équipée reçoit le chargeur plein ; un chargeur existant n’est JAMAIS réécrit', () => {
  const gun = (id, remaining) => line(id, { container: 'Ceinture', ref_caliber: '9 mm', ref_ammo_count: '15', ammo_remaining: remaining })
  const fresh = applyDeclaredSwap([SAC, CEINTURE, gun('g1', null)], { itemId: 'g1', replaceItemId: null })
  assert.equal(byId(fresh.items, 'g1').ammo_remaining, 15) // l'aperçu n'affiche pas « vide » : c'est ce que le serveur écrira
  const used = applyDeclaredSwap([SAC, CEINTURE, gun('g2', 4)], { itemId: 'g2', replaceItemId: null })
  assert.equal(byId(used.items, 'g2').ammo_remaining, 4)
  const empty = applyDeclaredSwap([SAC, CEINTURE, gun('g3', 0)], { itemId: 'g3', replaceItemId: null })
  assert.equal(byId(empty.items, 'g3').ammo_remaining, 0) // à sec (0) n'est pas « jamais équipée » (null)
})

test('applyDeclaredSwap — une arme sans calibre (grenade, arme de contact) : aucun chargeur inventé', () => {
  const { items } = applyDeclaredSwap([SAC, CEINTURE, line('gren', { container: 'Ceinture' })], { itemId: 'gren', replaceItemId: null })
  assert.equal(byId(items, 'gren').ammo_remaining, null)
})

test('applyDeclaredSwap — R6 : un deux-mains entrant range tout ce qui est tenu, bouclier compris', () => {
  const items = [SAC, CEINTURE, line('shield', { slots: ['BG', 'C', 'MG'] }), line('gun', { slots: ['MD'] }),
    line('rifle', { container: 'Sac', ref_location: '2M', ref_weight: 4 })]
  const { items: effective, decision } = applyDeclaredSwap(items, { itemId: 'rifle', replaceItemId: null })
  assert.equal(decision.status, 'planned')
  assert.deepEqual(byId(effective, 'rifle').slots, ['2M'])
  assert.equal(byId(effective, 'shield').slots, null)
  assert.equal(byId(effective, 'gun').slots, null)
})

test('applyDeclaredSwap — refusée (ne rentre pas) ou sans effet (déjà en main) : l’inventaire de base, avec la décision', () => {
  const heavy = [SAC, CEINTURE, line('rifle', { slots: ['2M'], ref_location: '2M', ref_weight: 6 }), line('gren', { container: 'Ceinture', ref_weight: 0.3 })]
  const refused = applyDeclaredSwap(heavy, { itemId: 'gren', replaceItemId: 'rifle' })
  assert.equal(refused.items, heavy)
  assert.equal(refused.decision.reason, GRAB_REFUSAL.NO_ROOM)
  const already = applyDeclaredSwap(heavy, { itemId: 'rifle', replaceItemId: null })
  assert.equal(already.items, heavy)
  assert.equal(already.decision.status, 'already')
})

test('applyDeclaredSwap — l’arme d’attaque rangée disparaît de la liste des armes en main, l’entrante y apparaît (la fenêtre en dérive ses listes)', () => {
  const items = [SAC, CEINTURE,
    line('scorpion', { slots: ['MD'], ref_fire_mode: 'CC/RC', ref_caliber: '9 mm', ref_ammo_count: '15', ammo_remaining: 7 }),
    line('frag', { container: 'Ceinture', ref_aoe_profile: { shape: 'circle', radiusM: 15, mechanic: 'grenade_frag' }, ref_name: 'Grenade à fragmentation' })]
  const before = flattenItemsBySlot(items).filter(weaponHasRangedAttackPath)
  assert.deepEqual(before.map(w => w.id), ['scorpion'])
  const { items: effective } = applyDeclaredSwap(items, { itemId: 'frag', replaceItemId: 'scorpion' })
  const after = flattenItemsBySlot(effective).filter(weaponHasRangedAttackPath)
  assert.deepEqual(after.map(w => w.id), ['frag'])
  assert.equal(byId(effective, 'scorpion').ammo_remaining, 7) // le chargeur de l'arme rangée est mémorisé, jamais touché (R16)
})

test('applyDeclaredSwap — l’arme rangée n’est PAS une munition (le combat l’aurait proposée au rechargement)', () => {
  const items = [SAC, CEINTURE,
    line('scorpion', { slots: ['MD'], ref_caliber: '9 mm', ref_family: 'Armes' }),
    line('frag', { container: 'Ceinture' }),
    line('balles', { ref_family: 'Munitions', ref_caliber: '9 mm' })]
  const { items: effective } = applyDeclaredSwap(items, { itemId: 'frag', replaceItemId: 'scorpion' })
  assert.deepEqual(effective.filter(item => isCompatibleAmmoItem(item, '9 mm')).map(item => item.id), ['balles'])
})

// ─── swapWarning ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('swapWarning — rien à signaler : pas de permutation, ou permutation possible', () => {
  const items = [SAC, CEINTURE, line('pistol', { slots: ['MG'] }), line('gren', { container: 'Ceinture' })]
  assert.equal(swapWarning(items, null), null)
  assert.equal(swapWarning(items, { itemId: 'gren', replaceItemId: 'pistol' }), null)
})

test('swapWarning — « ne rentre pas » nomme l’objet qui sort et le conteneur (de quoi écrire « X ne rentre pas dans la Ceinture »)', () => {
  const items = [SAC, CEINTURE, line('rifle', { slots: ['2M'], ref_location: '2M', ref_weight: 6, custom_name: 'Ma Gatling' }),
    line('gren', { container: 'Ceinture', ref_weight: 0.3 })]
  assert.deepEqual(swapWarning(items, { itemId: 'gren', replaceItemId: 'rifle' }),
    { reason: GRAB_REFUSAL.NO_ROOM, container: 'Ceinture', itemName: 'Ma Gatling' })
})

test('swapWarning — deux objets sortants (deux-mains entrant) : les deux noms', () => {
  const items = [SAC, CEINTURE, line('a', { slots: ['MG'], ref_weight: 2, ref_name: 'Pistolet' }), line('b', { slots: ['MD'], ref_weight: 2, ref_name: 'Épée' }),
    line('rifle', { container: 'Ceinture', ref_location: '2M', ref_weight: 0.5 })]
  assert.deepEqual(swapWarning(items, { itemId: 'rifle', replaceItemId: null }),
    { reason: GRAB_REFUSAL.NO_ROOM, container: 'Ceinture', itemName: 'Pistolet, Épée' })
})

test('swapWarning — les autres motifs : pas de Sac, mains pleines, déjà en main, objet parti', () => {
  const held = [line('a', { slots: ['MG'] }), line('b', { slots: ['MD'] })]
  const gren = line('gren', { container: 'Ceinture' })
  assert.deepEqual(swapWarning([CEINTURE, gren], { itemId: 'gren', replaceItemId: null }), { reason: GRAB_REFUSAL.NO_SAC })
  assert.deepEqual(swapWarning([SAC, CEINTURE, ...held, gren], { itemId: 'gren', replaceItemId: null }), { reason: GRAB_REFUSAL.HANDS_FULL })
  assert.deepEqual(swapWarning([SAC, CEINTURE, ...held], { itemId: 'a', replaceItemId: null }), { reason: GRAB_REFUSAL.ALREADY_IN_HAND })
  assert.deepEqual(swapWarning([SAC, CEINTURE], { itemId: 'disparu', replaceItemId: null }), { reason: GRAB_REFUSAL.NOT_FOUND })
})

// ─── heldItemsWithoutActionRow ───────────────────────────────────────────────────────────────────────────────────────

test('heldItemsWithoutActionRow — le bouclier et la grenade sans profil de zone : tenus, mais sans ligne d’action', () => {
  const items = [SAC, CEINTURE, line('gun', { slots: ['MD'], ref_fire_mode: 'CC' }), line('shield', { slots: ['BG', 'C', 'MG'] }),
    line('gaz', { slots: ['2M'] }), line('rangee', { container: 'Ceinture' })]
  const rows = heldItemsWithoutActionRow(items, ['gun'])
  assert.deepEqual(rows.map(row => [row.id, row.slot]), [['shield', 'MG'], ['gaz', '2M']]) // ordre des mains ; le bouclier se lit par sa main
})

test('heldItemsWithoutActionRow — tout est listé, ou rien n’est tenu : aucune ligne ; un objet n’apparaît jamais deux fois', () => {
  assert.deepEqual(heldItemsWithoutActionRow([SAC, CEINTURE], []), [])
  assert.deepEqual(heldItemsWithoutActionRow([line('gun', { slots: ['MD'] })], new Set(['gun'])), [])
  const twice = [line('shield', { slots: ['MG', 'MD'] })] // un objet sur deux mains n'a qu'une ligne
  assert.equal(heldItemsWithoutActionRow(twice, []).length, 1)
})
