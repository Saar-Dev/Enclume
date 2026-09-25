import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveGrabAction } from './combatGrabService.js'
import { GRAB_REFUSAL } from '../services/inventoryService.js'
import { WS } from '../../../shared/events.js'

// PLAN_PRISE_EN_MAIN.md D5 — la résolution DIT chaque issue (permutée, déjà en main, chaque refus, erreur) et rediffuse
// l'inventaire ; aucune règle n'est décidée ici. Accès à l'inventaire ET diffusion injectés : aucune base requise.
// (Le module importe inventoryService donc knex, mais aucune requête n'est émise.)

function makeIo() {
  const emitted = []
  const io = { to: (room) => ({ emit: (event, data) => emitted.push({ room, event, data }) }) }
  return { io, emitted }
}
function makeBroadcast() {
  const calls = []
  return { calls, broadcast: async (io, characterId, campaignId, eventName, payload) => { calls.push({ characterId, campaignId, eventName, payload }) } }
}
const character = { id: 'char-1', name: 'Kaiser' }
const action = { modifiers: { itemId: 'item-1' } }
const grenade = { id: 'item-1', custom_name: null, ref_name: 'Grenade à fragmentation', slots: ['MD'] }

test('resolveGrabAction — « Mains nues » : l’objet et l’intention sont transmis, inventaire rediffusé puis ligne de chat avec l’origine', async () => {
  const { io, emitted } = makeIo()
  const { calls, broadcast } = makeBroadcast()
  const result = await resolveGrabAction(io, 'camp-1', character, action, {
    broadcast,
    swap: async (charId, args) => {
      assert.equal(charId, 'char-1')
      assert.deepEqual(args, { incomingId: 'item-1', clickedItemId: null })
      return { status: 'swapped', item: grenade, outgoing: [], slot: 'MD', fromContainer: 'Ceinture', stowedIn: 'Ceinture' }
    },
  })
  assert.deepEqual(result, { status: 'swapped' })
  assert.deepEqual(calls, [{ characterId: 'char-1', campaignId: 'camp-1', eventName: 'INVENTORY_UPDATED', payload: { item: grenade } }])
  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].event, WS.COMBAT_SYSTEM_NOTICE)
  assert.equal(emitted[0].data.i18nKey, 'session.grabTaken')
  assert.deepEqual(emitted[0].data.params, { label: 'Kaiser', item: 'Grenade à fragmentation', from: 'Ceinture' })
  assert.equal(emitted[0].room, 'camp-1')
})

test('resolveGrabAction — remplacement : la ligne cliquée est transmise, chaque objet déplacé est rediffusé, UNE ligne dit qui est rangé où', async () => {
  const { io, emitted } = makeIo()
  const { calls, broadcast } = makeBroadcast()
  const pistol = { id: 'p1', custom_name: null, ref_name: 'Pistolet', slots: null }
  const shield = { id: 's1', custom_name: 'Mon bouclier', ref_name: 'Bouclier - Petit', slots: null }
  await resolveGrabAction(io, 'camp-1', character, { modifiers: { itemId: 'item-1', replaceItemId: 'p1' } }, {
    broadcast,
    swap: async (_charId, args) => {
      assert.deepEqual(args, { incomingId: 'item-1', clickedItemId: 'p1' })
      return { status: 'swapped', item: grenade, outgoing: [pistol, shield], slot: 'MD', fromContainer: 'Sac', stowedIn: 'Sac' }
    },
  })
  assert.deepEqual(calls.map(c => c.payload.item.id), ['item-1', 'p1', 's1'])
  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].data.i18nKey, 'session.swapDone')
  assert.deepEqual(emitted[0].data.params, { label: 'Kaiser', item: 'Grenade à fragmentation', from: 'Sac', stowed: 'Pistolet, Mon bouclier', to: 'Sac' })
})

test('resolveGrabAction — une diffusion en échec ne défait pas la permutation : la ligne de chat est quand même émise', async () => {
  const { io, emitted } = makeIo()
  const originalError = console.error
  console.error = () => {}
  try {
    const result = await resolveGrabAction(io, 'camp-1', character, action, {
      broadcast: async () => { throw new Error('salle injoignable') },
      swap: async () => ({ status: 'swapped', item: grenade, outgoing: [], slot: 'MD', fromContainer: 'Sac', stowedIn: 'Sac' }),
    })
    assert.deepEqual(result, { status: 'swapped' })
  } finally { console.error = originalError }
  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].data.i18nKey, 'session.grabTaken')
})

test('resolveGrabAction — nom personnalisé prioritaire sur le nom catalogue', async () => {
  const { io, emitted } = makeIo()
  await resolveGrabAction(io, 'camp-1', character, action, {
    broadcast: makeBroadcast().broadcast,
    swap: async () => ({ status: 'swapped', item: { id: 'i', custom_name: 'Ma grenade', ref_name: 'Grenade' }, outgoing: [], slot: 'MG', fromContainer: 'Sac', stowedIn: 'Sac' }),
  })
  assert.equal(emitted[0].data.params.item, 'Ma grenade')
})

test('resolveGrabAction — déjà en main : une ligne de chat, aucune rediffusion d’inventaire', async () => {
  const { io, emitted } = makeIo()
  const { calls, broadcast } = makeBroadcast()
  const result = await resolveGrabAction(io, 'camp-1', character, action, {
    broadcast,
    swap: async () => ({ status: 'already', item: { id: 'item-1', ref_name: 'Grenade' } }),
  })
  assert.deepEqual(result, { status: 'already' })
  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].data.i18nKey, 'session.grabAlready')
  assert.equal(calls.length, 0)
})

test('resolveGrabAction — chaque code de refus a sa propre ligne de chat, sans rediffusion d’inventaire', async () => {
  const expected = {
    [GRAB_REFUSAL.NOT_FOUND]:             'session.grabRefusedNotFound',
    [GRAB_REFUSAL.NOT_CARRIED]:           'session.grabRefusedNotCarried',
    [GRAB_REFUSAL.EQUIPPED]:              'session.grabRefusedEquipped',
    [GRAB_REFUSAL.NOT_HOLDABLE]:          'session.grabRefusedNotHoldable',
    [GRAB_REFUSAL.NO_SAC]:                'session.grabRefusedNoSac',
    [GRAB_REFUSAL.HANDS_FULL]:            'session.grabRefusedHandsFull',
    [GRAB_REFUSAL.ALREADY_IN_HAND]:       'session.grabRefusedAlreadyInHand',
    [GRAB_REFUSAL.CONTAINER_UNAVAILABLE]: 'session.grabRefusedContainerUnavailable',
    [GRAB_REFUSAL.NO_ROOM]:               'session.grabRefusedNoRoom',
    [GRAB_REFUSAL.ARMOR_LAYERS]:          'session.grabRefusedArmorLayers',
  }
  assert.equal(new Set(Object.keys(expected)).size, Object.keys(GRAB_REFUSAL).length, 'chaque code de refus est couvert')
  for (const [reason, key] of Object.entries(expected)) {
    const { io, emitted } = makeIo()
    const { calls, broadcast } = makeBroadcast()
    const result = await resolveGrabAction(io, 'camp-1', character, action, { broadcast, swap: async () => ({ status: 'refused', reason }) })
    assert.deepEqual(result, { status: 'refused', reason })
    assert.equal(emitted.length, 1, reason)
    assert.equal(emitted[0].event, WS.COMBAT_SYSTEM_NOTICE)
    assert.equal(emitted[0].data.i18nKey, key)
    assert.equal(emitted[0].data.params.label, 'Kaiser')
    assert.equal(calls.length, 0, reason)
  }
})

test('resolveGrabAction — R17, « ne rentre pas » : le refus nomme l’arme (ou les armes) remplacée(s) et le conteneur', async () => {
  const { io, emitted } = makeIo()
  const items = { r1: { id: 'r1', ref_name: 'Fusil d’assaut' }, s1: { id: 's1', custom_name: 'Ma lame', ref_name: 'Couteau' } }
  const result = await resolveGrabAction(io, 'camp-1', character, action, {
    broadcast: makeBroadcast().broadcast,
    loadItem: async (id) => items[id],
    swap: async () => ({ status: 'refused', reason: GRAB_REFUSAL.NO_ROOM, container: 'Ceinture', outgoingIds: ['r1', 's1'] }),
  })
  assert.deepEqual(result, { status: 'refused', reason: GRAB_REFUSAL.NO_ROOM })
  assert.equal(emitted[0].data.i18nKey, 'session.grabRefusedNoRoom')
  assert.deepEqual(emitted[0].data.params, { label: 'Kaiser', container: 'Ceinture', item: 'Fusil d’assaut, Ma lame' })
})

test('resolveGrabAction — le nom d’un objet du refus introuvable ne bloque jamais le message', async () => {
  const { io, emitted } = makeIo()
  const originalError = console.error
  console.error = () => {}
  try {
    await resolveGrabAction(io, 'camp-1', character, action, {
      broadcast: makeBroadcast().broadcast,
      loadItem: async () => { throw new Error('base injoignable') },
      swap: async () => ({ status: 'refused', reason: GRAB_REFUSAL.NO_ROOM, container: 'Sac', outgoingIds: ['r1'] }),
    })
  } finally { console.error = originalError }
  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].data.i18nKey, 'session.grabRefusedNoRoom')
  assert.equal(emitted[0].data.params.container, 'Sac')
})

test('resolveGrabAction — erreur inattendue : le Tour continue, une ligne d’erreur est émise (jamais d’exception)', async () => {
  const { io, emitted } = makeIo()
  const originalError = console.error
  console.error = () => {}
  try {
    const result = await resolveGrabAction(io, 'camp-1', character, action, {
      broadcast: makeBroadcast().broadcast,
      swap: async () => { throw new Error('incident base') },
    })
    assert.deepEqual(result, { status: 'error' })
  } finally { console.error = originalError }
  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].data.i18nKey, 'session.grabError')
})

test('resolveGrabAction — action sans objet, personnage sans nom : refus propre (jamais de throw)', async () => {
  const { io, emitted } = makeIo()
  const result = await resolveGrabAction(io, 'camp-1', { id: 'char-2' }, {}, {
    broadcast: makeBroadcast().broadcast,
    swap: async (charId, args) => {
      assert.equal(args.incomingId, null)
      return { status: 'refused', reason: GRAB_REFUSAL.NOT_FOUND }
    },
  })
  assert.equal(result.status, 'refused')
  assert.equal(emitted[0].data.params.label, '?')
})
