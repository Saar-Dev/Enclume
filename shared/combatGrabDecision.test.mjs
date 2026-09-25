import test from 'node:test'
import assert from 'node:assert/strict'

import { GRAB_REFUSAL, decideHandSwap } from './combatGrabItem.js'

// « Permuter » (docs/Old/PLAN_PRISE_EN_MAIN.md) — la DÉCISION complète, partagée serveur (résolution, dans la transaction) et
// client (aperçu de la fenêtre de déclaration) : classification, Sac requis, objets sortants, main, place du rangement.
// Les règles élémentaires sont testées une à une dans combatGrabItem.test.mjs / combatGrabSwap.test.mjs ; ici, leur ENCHAÎNEMENT.

const line = (id, { container = 'Sac', slots = null, location = 'M', weight = null, capacity = null, quantity = 1 } = {}) =>
  ({ id, container, slots, quantity, ref_location: location, ref_weight: weight, ref_capacity: capacity })

const SAC = line('sac', { slots: ['D'], location: 'D', capacity: 20 })
const CEINTURE = line('ceinture', { slots: ['Ce'], location: 'Ce', capacity: 3 })
const base = () => [SAC, CEINTURE]

test('decideHandSwap — « Mains nues » depuis la Ceinture : planifiée, rien ne sort, la grenade entre en MD, rangement = conteneur d’origine', () => {
  const items = [...base(), line('gren', { container: 'Ceinture', weight: 0.3 })]
  assert.deepEqual(decideHandSwap({ items, incomingId: 'gren' }),
    { status: 'planned', incomingId: 'gren', targetSlot: 'MD', outgoingIds: [], origin: 'Ceinture', stowContainer: 'Ceinture' })
})

test('decideHandSwap — R7 : la ligne cliquée sort, vers le conteneur d’origine de l’entrant, dans SA main', () => {
  const items = [...base(), line('pistol', { slots: ['MG'], weight: 1 }), line('gren', { container: 'Ceinture', weight: 0.3 })]
  assert.deepEqual(decideHandSwap({ items, incomingId: 'gren', clickedItemId: 'pistol' }),
    { status: 'planned', incomingId: 'gren', targetSlot: 'MG', outgoingIds: ['pistol'], origin: 'Ceinture', stowContainer: 'Ceinture' })
})

test('decideHandSwap — objet introuvable, non porté, déjà porté ailleurs, non tenable : refus structurels, dans l’ordre de classifyGrabCandidate', () => {
  const items = [...base(),
    line('coffre', { container: 'Coffre' }), line('armure', { slots: ['T'], location: 'T' }), line('bidon', { container: 'Sac', location: 'B' })]
  assert.deepEqual(decideHandSwap({ items, incomingId: 'inconnu' }), { status: 'refused', reason: GRAB_REFUSAL.NOT_FOUND })
  assert.deepEqual(decideHandSwap({ items, incomingId: 'coffre' }), { status: 'refused', reason: GRAB_REFUSAL.NOT_CARRIED })
  assert.deepEqual(decideHandSwap({ items, incomingId: 'armure' }), { status: 'refused', reason: GRAB_REFUSAL.EQUIPPED })
  assert.deepEqual(decideHandSwap({ items, incomingId: 'bidon' }), { status: 'refused', reason: GRAB_REFUSAL.NOT_HOLDABLE })
  assert.deepEqual(decideHandSwap({ items: undefined, incomingId: 'x' }), { status: 'refused', reason: GRAB_REFUSAL.NOT_FOUND })
})

test('decideHandSwap — déjà en main : « already », jamais de permutation', () => {
  const items = [...base(), line('gun', { slots: ['MD'] })]
  assert.deepEqual(decideHandSwap({ items, incomingId: 'gun' }), { status: 'already' })
})

test('decideHandSwap — R12 : sans Sac équipé (aucun objet en slot D), NO_SAC', () => {
  const items = [CEINTURE, line('gren', { container: 'Ceinture' })]
  assert.deepEqual(decideHandSwap({ items, incomingId: 'gren' }), { status: 'refused', reason: GRAB_REFUSAL.NO_SAC })
})

test('decideHandSwap — mains pleines sans ligne cliquée : HANDS_FULL', () => {
  const items = [...base(), line('a', { slots: ['MG'] }), line('b', { slots: ['MD'] }), line('gren', { container: 'Ceinture' })]
  assert.deepEqual(decideHandSwap({ items, incomingId: 'gren' }), { status: 'refused', reason: GRAB_REFUSAL.HANDS_FULL })
})

test('decideHandSwap — R17 : un fusil de 6 kg ne rentre pas dans la Ceinture de 3 kg — refus qui nomme le conteneur et l’objet sortant', () => {
  const items = [...base(), line('rifle', { slots: ['2M'], location: '2M', weight: 6 }), line('gren', { container: 'Ceinture', weight: 0.3 })]
  assert.deepEqual(decideHandSwap({ items, incomingId: 'gren', clickedItemId: 'rifle' }),
    { status: 'refused', reason: GRAB_REFUSAL.NO_ROOM, container: 'Ceinture', outgoingIds: ['rifle'] })
})

test('decideHandSwap — R5 « ne jamais empirer » : une arme plus légère que celle qui entre rentre toujours, même dans un conteneur déjà trop plein', () => {
  // Ceinture de 3 kg déjà à 5 kg (trop pleine) : la grenade de 0,3 kg sort pour un pistolet de 0,2 kg → le poids baisse, accepté.
  const items = [...base(), line('heavy', { container: 'Ceinture', weight: 4.7 }), line('gren', { container: 'Ceinture', weight: 0.3 }),
    line('light', { slots: ['MD'], weight: 0.2 })]
  const decision = decideHandSwap({ items, incomingId: 'gren', clickedItemId: 'light' })
  assert.equal(decision.status, 'planned')
  assert.deepEqual(decision.outgoingIds, ['light'])
})

test('decideHandSwap — R6 : un deux-mains entrant fait sortir tout ce qui est tenu, poids CUMULÉS pour la capacité', () => {
  // Deux objets de 2 kg sortent vers le Sac (20 kg) : rentre. Vers la Ceinture (3 kg) : 4 kg > 3 kg → refus.
  const held = [line('a', { slots: ['MG'], weight: 2 }), line('b', { slots: ['MD'], weight: 2 })]
  const fromSac = decideHandSwap({ items: [...base(), ...held, line('rifle', { container: 'Sac', location: '2M', weight: 5 })], incomingId: 'rifle' })
  assert.equal(fromSac.status, 'planned')
  assert.equal(fromSac.targetSlot, '2M')
  assert.deepEqual(fromSac.outgoingIds, ['a', 'b'])
  const fromBelt = decideHandSwap({ items: [...base(), ...held, line('rifleB', { container: 'Ceinture', location: '2M', weight: 0.5 })], incomingId: 'rifleB' })
  assert.deepEqual(fromBelt, { status: 'refused', reason: GRAB_REFUSAL.NO_ROOM, container: 'Ceinture', outgoingIds: ['a', 'b'] })
})

test('decideHandSwap — le bouclier (slot composite) sort comme une arme ; un poids absent compte 0', () => {
  const items = [...base(), line('shield', { slots: ['BG', 'C', 'MG'], weight: null }), line('gren', { container: 'Ceinture', weight: 0.3 })]
  assert.deepEqual(decideHandSwap({ items, incomingId: 'gren', clickedItemId: 'shield' }),
    { status: 'planned', incomingId: 'gren', targetSlot: 'MG', outgoingIds: ['shield'], origin: 'Ceinture', stowContainer: 'Ceinture' })
})

test('decideHandSwap — conteneur d’origine non équipé (Ceinture retirée) : sans objet sortant rien ne le requiert, avec objet sortant CONTAINER_UNAVAILABLE', () => {
  const noBelt = [SAC, line('gren', { container: 'Ceinture' }), line('pistol', { slots: ['MD'], weight: 1 })]
  assert.equal(decideHandSwap({ items: noBelt.filter(i => i.id !== 'pistol'), incomingId: 'gren' }).status, 'planned')
  assert.deepEqual(decideHandSwap({ items: noBelt, incomingId: 'gren', clickedItemId: 'pistol' }),
    { status: 'refused', reason: GRAB_REFUSAL.CONTAINER_UNAVAILABLE, container: 'Ceinture', outgoingIds: ['pistol'] })
})

test('decideHandSwap — ne modifie jamais son entrée (fonction pure, partagée avec un état d’interface)', () => {
  const items = Object.freeze([...base(), line('pistol', { slots: ['MG'], weight: 1 }), line('gren', { container: 'Ceinture' })].map(Object.freeze))
  assert.doesNotThrow(() => decideHandSwap({ items, incomingId: 'gren', clickedItemId: 'pistol' }))
})
