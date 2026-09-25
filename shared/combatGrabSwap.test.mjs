import test from 'node:test'
import assert from 'node:assert/strict'

import { GRAB_REFUSAL, planHandSwap, planStowDestination } from './combatGrabItem.js'

// « Permuter » (docs/Old/PLAN_PRISE_EN_MAIN.md) — règles pures partagées client / serveur.
// `planHandSwap` CHOISIT (quels objets sortent, quelle main) ; la validité des emplacements reste à `applyItemUpdate`.

const item = (id, ...slots) => ({ id, slots })

// ─── planHandSwap ────────────────────────────────────────────────────────────────────────────────────────────────────

test('planHandSwap — « Mains nues », deux mains vides : MD d’abord, rien ne sort', () => {
  assert.deepEqual(planHandSwap({ incoming: { id: 'g', refLocation: 'M' }, items: [item('a', 'C')] }),
    { ok: true, targetSlot: 'MD', outgoingIds: [] })
})

test('planHandSwap — « Mains nues » : MD prise, la grenade entre en MG ; les deux prises : mains pleines', () => {
  const incoming = { id: 'g', refLocation: 'M' }
  assert.deepEqual(planHandSwap({ incoming, items: [item('w', 'MD')] }), { ok: true, targetSlot: 'MG', outgoingIds: [] })
  assert.deepEqual(planHandSwap({ incoming, items: [item('w', 'MD'), item('v', 'MG')] }), { ok: false, reason: GRAB_REFUSAL.HANDS_FULL })
})

test('planHandSwap — « Mains nues » : un deux-mains ou une arme montée occupe les deux mains', () => {
  const incoming = { id: 'g', refLocation: 'M' }
  assert.equal(planHandSwap({ incoming, items: [item('rifle', '2M')] }).reason, GRAB_REFUSAL.HANDS_FULL)
  assert.equal(planHandSwap({ incoming, items: [item('mg', 'Tr')] }).reason, GRAB_REFUSAL.HANDS_FULL)
})

test('planHandSwap — R7, une main sur une ligne tenue : cet objet sort, l’entrant prend SA main', () => {
  const incoming = { id: 'g', refLocation: 'M' }
  const items = [item('left', 'MG'), item('right', 'MD')]
  assert.deepEqual(planHandSwap({ incoming, items, clickedItemId: 'left' }), { ok: true, targetSlot: 'MG', outgoingIds: ['left'] })
  assert.deepEqual(planHandSwap({ incoming, items, clickedItemId: 'right' }), { ok: true, targetSlot: 'MD', outgoingIds: ['right'] })
})

test('planHandSwap — R7 : une ligne de deux-mains libère les deux mains, l’entrant prend la main directrice (MD)', () => {
  const incoming = { id: 'g', refLocation: 'M' }
  assert.deepEqual(planHandSwap({ incoming, items: [item('rifle', '2M')], clickedItemId: 'rifle' }),
    { ok: true, targetSlot: 'MD', outgoingIds: ['rifle'] })
  assert.deepEqual(planHandSwap({ incoming, items: [item('mg', 'Tr')], clickedItemId: 'mg' }),
    { ok: true, targetSlot: 'MD', outgoingIds: ['mg'] })
})

test('planHandSwap — un bouclier (slot composite) se lit par sa main ; il est permutable comme une arme', () => {
  const shield = item('shield', 'BG', 'C', 'MG')
  // Le bouclier tenu en MG sort, l'arme entrante prend MG.
  assert.deepEqual(planHandSwap({ incoming: { id: 'w', refLocation: 'M' }, items: [shield, item('gun', 'MD')], clickedItemId: 'shield' }),
    { ok: true, targetSlot: 'MG', outgoingIds: ['shield'] })
  // Un bouclier ENTRANT (catalogué `M`) est un objet à une main : il entre dans la main libre.
  assert.deepEqual(planHandSwap({ incoming: { id: 's2', refLocation: 'M' }, items: [item('gun', 'MD')] }),
    { ok: true, targetSlot: 'MG', outgoingIds: [] })
})

test('planHandSwap — ligne cliquée qui n’est plus tenue : ignorée, l’objet entre dans une main libre (sinon mains pleines)', () => {
  const incoming = { id: 'g', refLocation: 'M' }
  assert.deepEqual(planHandSwap({ incoming, items: [item('w', 'MD')], clickedItemId: 'disparu' }), { ok: true, targetSlot: 'MG', outgoingIds: [] })
  assert.equal(planHandSwap({ incoming, items: [item('w', 'MD'), item('v', 'MG')], clickedItemId: 'disparu' }).reason, GRAB_REFUSAL.HANDS_FULL)
})

test('planHandSwap — R6, entrant à deux mains : TOUT ce qui est tenu sort (armes, arme montée, bouclier), la ligne cliquée est indifférente', () => {
  const items = [item('gun', 'MD'), item('shield', 'BG', 'C', 'MG'), item('armor', 'T')]
  assert.deepEqual(planHandSwap({ incoming: { id: 'r', refLocation: '2M' }, items }), { ok: true, targetSlot: '2M', outgoingIds: ['gun', 'shield'] })
  assert.deepEqual(planHandSwap({ incoming: { id: 'r', refLocation: '2M' }, items, clickedItemId: 'gun' }).outgoingIds, ['gun', 'shield'])
  assert.deepEqual(planHandSwap({ incoming: { id: 'r', refLocation: '2M' }, items: [item('mg', 'Tr')] }), { ok: true, targetSlot: '2M', outgoingIds: ['mg'] })
})

test('planHandSwap — arme 2M/Tr entrante : traitée comme un deux-mains ; mains vides : rien ne sort', () => {
  assert.deepEqual(planHandSwap({ incoming: { id: 'h', refLocation: '2M/Tr' }, items: [] }), { ok: true, targetSlot: '2M', outgoingIds: [] })
  assert.deepEqual(planHandSwap({ incoming: { id: 'h', refLocation: '2M/Tr' }, items: [item('w', 'MD')] }), { ok: true, targetSlot: '2M', outgoingIds: ['w'] })
})

test('planHandSwap — refus : trépied pur, objet non tenable, entrant absent, entrant déjà en main', () => {
  assert.equal(planHandSwap({ incoming: { id: 't', refLocation: 'Tr' }, items: [] }).reason, GRAB_REFUSAL.NOT_HOLDABLE)
  assert.equal(planHandSwap({ incoming: { id: 'a', refLocation: 'T' }, items: [] }).reason, GRAB_REFUSAL.NOT_HOLDABLE)
  assert.equal(planHandSwap({ incoming: { id: 'x', refLocation: null }, items: [] }).reason, GRAB_REFUSAL.NOT_HOLDABLE)
  assert.equal(planHandSwap({ incoming: null, items: [] }).reason, GRAB_REFUSAL.NOT_FOUND)
  assert.equal(planHandSwap({ incoming: { id: 'w', refLocation: 'M' }, items: [item('w', 'MD')] }).reason, GRAB_REFUSAL.ALREADY_IN_HAND)
})

test('planHandSwap — les emplacements hors main (armure, Sac, Ceinture) ne sont jamais « tenus » ; entrée absente ou vide : jamais d’exception', () => {
  const items = [item('armor', 'T'), item('sac', 'D'), item('belt', 'Ce'), { id: 'nu' }, { id: 'nul', slots: null }]
  assert.deepEqual(planHandSwap({ incoming: { id: 'g', refLocation: 'M' }, items }), { ok: true, targetSlot: 'MD', outgoingIds: [] })
  assert.deepEqual(planHandSwap({ incoming: { id: 'g', refLocation: 'M' } }), { ok: true, targetSlot: 'MD', outgoingIds: [] })
})

// ─── planStowDestination — R4 (conteneur d'origine seulement) + R5 (ne jamais empirer) + R17 (refus) ───────────────────

test('planStowDestination — rien à ranger (« Mains nues ») : accepté, même sans conteneur équipé', () => {
  assert.deepEqual(planStowDestination({ origin: 'Ceinture', originState: { available: false, capacityKg: 3, fillKg: 0 }, outgoingKg: [], incomingKg: 0.3 }),
    { ok: true, container: 'Ceinture' })
})

test('planStowDestination — conteneur d’origine non équipé : CONTAINER_UNAVAILABLE', () => {
  assert.deepEqual(planStowDestination({ origin: 'Sac', originState: { available: false, capacityKg: null, fillKg: 0 }, outgoingKg: [1], incomingKg: 0 }),
    { ok: false, reason: GRAB_REFUSAL.CONTAINER_UNAVAILABLE, container: 'Sac' })
})

test('planStowDestination — exemples du plan (grenade 0,3 kg, Ceinture 3 kg) : un fusil de 6 kg ne rentre pas, un pistolet de 1 kg oui', () => {
  const originState = { available: true, capacityKg: 3, fillKg: 0.3 } // la grenade entrante y est encore rangée
  assert.deepEqual(planStowDestination({ origin: 'Ceinture', originState, outgoingKg: [6], incomingKg: 0.3 }),
    { ok: false, reason: GRAB_REFUSAL.NO_ROOM, container: 'Ceinture' })
  assert.deepEqual(planStowDestination({ origin: 'Ceinture', originState, outgoingKg: [1], incomingKg: 0.3 }), { ok: true, container: 'Ceinture' })
})

test('planStowDestination — « ne jamais empirer » : un conteneur déjà trop plein accepte plus léger ou égal, refuse plus lourd', () => {
  const overfull = { available: true, capacityKg: 8, fillKg: 10 }
  assert.equal(planStowDestination({ origin: 'Sac', originState: overfull, outgoingKg: [1.5], incomingKg: 2 }).ok, true)
  assert.equal(planStowDestination({ origin: 'Sac', originState: overfull, outgoingKg: [2], incomingKg: 2 }).ok, true) // égal : pas pire
  assert.equal(planStowDestination({ origin: 'Sac', originState: overfull, outgoingKg: [2], incomingKg: 1 }).reason, GRAB_REFUSAL.NO_ROOM)
})

test('planStowDestination — plusieurs sortants (entrant à deux mains) : poids cumulés dans un seul calcul, un seul refus', () => {
  const originState = { available: true, capacityKg: 3, fillKg: 0.3 }
  assert.equal(planStowDestination({ origin: 'Ceinture', originState, outgoingKg: [1.5, 1.4], incomingKg: 0.3 }).ok, true)
  assert.equal(planStowDestination({ origin: 'Ceinture', originState, outgoingKg: [1.5, 1.6], incomingKg: 0.3 }).reason, GRAB_REFUSAL.NO_ROOM)
})

test('planStowDestination — capacité absente = sans limite ; poids absent = 0', () => {
  assert.equal(planStowDestination({ origin: 'Sac', originState: { available: true, capacityKg: null, fillKg: 500 }, outgoingKg: [900], incomingKg: 0 }).ok, true)
  assert.equal(planStowDestination({ origin: 'Ceinture', originState: { available: true, capacityKg: 3, fillKg: 3 }, outgoingKg: [null, undefined], incomingKg: undefined }).ok, true)
})
