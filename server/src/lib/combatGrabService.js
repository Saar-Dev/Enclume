// server/src/lib/combatGrabService.js — résolution de l'action « Permuter » (docs/Old/PLAN_PRISE_EN_MAIN.md).
//
// Appelée par la boucle des actions simples de la Résolution (socketCombatResolution.js), AVANT l'entrée complexe du même token :
// la permutation précède donc un éventuel lancer / tir du même Tour. Ce module ne décide d'aucune règle : l'ÉTAT (mains, Sac requis,
// capacité, écriture en UNE transaction) vit dans `inventoryService.swapItemInHand`, le CHOIX dans `shared/combatGrabItem.js`, le
// COÛT d'Initiative a déjà été appliqué à l'annonce (shared/combatIniCost.js). Ici : appeler, puis DIRE ce qui s'est passé —
// chaque branche (permutée, déjà en main, chaque refus, erreur) a sa ligne de chat, et l'inventaire est rediffusé aux clients
// (le client ne se met à jour que par les événements INVENTORY_*, à la salle choisie par `inventoryBroadcast`).
//
// Chat : message système + clé i18n résolue côté client (jamais de texte français émis ici, `rules/i18n.md`).

import { WS } from '../../../shared/events.js'
import { swapItemInHand, getItemWithRef, GRAB_REFUSAL } from '../services/inventoryService.js'
import { broadcastInventoryEvent } from './inventoryBroadcast.js'
import { itemDisplayName } from './combatHandWeaponNotice.js'

// Code de refus → clé i18n (client/src/locales/fr.json, section `session`). Un code sans entrée ici est un bug : le test de ce
// module compare cette table à `GRAB_REFUSAL` (chaque branche a sa ligne de chat).
const REFUSAL_I18N_KEY = Object.freeze({
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
})

const displayName = itemDisplayName

/**
 * @param {import('socket.io').Server} io
 * @param {string} campaignId
 * @param {{ id: string, name?: string|null }} character  le personnage qui agit (humanoïde)
 * @param {{ modifiers?: { itemId?: string|null, replaceItemId?: string|null } }} action  ligne combat_actions (`micro` / `grab_item`) :
 *        `itemId` = l'objet entrant, `replaceItemId` = la ligne d'objet tenu sur laquelle « Permuter » a été cliqué (absent = « Mains nues »)
 * @param {object} [deps]  accès injectables pour les tests (défaut : les services réels)
 * @param {typeof swapItemInHand} [deps.swap]
 * @param {typeof getItemWithRef} [deps.loadItem]  nom des objets d'un refus « ne rentre pas »
 * @param {typeof broadcastInventoryEvent} [deps.broadcast]
 * @returns {Promise<{ status: 'swapped'|'already'|'refused'|'error', reason?: string }>}
 */
export async function resolveGrabAction(io, campaignId, character, action, {
  swap = swapItemInHand, loadItem = getItemWithRef, broadcast = broadcastInventoryEvent,
} = {}) {
  const label = character.name ?? '?'
  const notice = (i18nKey, params = {}) => io.to(campaignId).emit(WS.COMBAT_SYSTEM_NOTICE, {
    i18nKey, params: { label, ...params }, timestamp: new Date().toISOString(),
  })

  let result
  try {
    result = await swap(character.id, {
      incomingId: action.modifiers?.itemId ?? null,
      clickedItemId: action.modifiers?.replaceItemId ?? null,
    })
  } catch (err) {
    // Incident base ou erreur d'équipement sans code : le Tour continue, le joueur est prévenu — jamais une résolution cassée
    // pour une permutation ratée. La transaction de `swapItemInHand` a tout annulé : aucun objet n'a bougé.
    console.error(`[WS] resolveGrabAction — échec character:${character.id} item:${action.modifiers?.itemId} : ${err.message}`)
    notice('session.grabError')
    return { status: 'error' }
  }

  if (result.status === 'refused') {
    const params = {}
    if (result.container) params.container = result.container
    if (result.outgoingIds?.length) {
      // « X ne rentre pas dans la Ceinture » : le refus nomme l'arme (ou les armes) remplacée(s) — best-effort, jamais bloquant.
      try {
        params.item = (await Promise.all(result.outgoingIds.map(async id => displayName(await loadItem(id))))).join(', ')
      } catch (err) {
        console.error(`[WS] resolveGrabAction — nom des objets du refus introuvable : ${err.message}`)
      }
    }
    notice(REFUSAL_I18N_KEY[result.reason] ?? 'session.grabError', params)
    return { status: 'refused', reason: result.reason }
  }

  if (result.status === 'already') {
    notice('session.grabAlready', { item: displayName(result.item) })
    return { status: 'already' }
  }

  // Permutée : rediffuser chaque objet déplacé (le client ne se met à jour que par INVENTORY_*), puis raconter.
  // La diffusion est best-effort : les écritures sont déjà validées (commit), une salle injoignable ne défait rien.
  for (const item of [result.item, ...result.outgoing]) {
    try {
      await broadcast(io, character.id, campaignId, 'INVENTORY_UPDATED', { item })
    } catch (err) {
      console.error(`[WS] resolveGrabAction — diffusion inventaire échouée (permutation déjà écrite) item:${item?.id} : ${err.message}`)
    }
  }
  if (result.outgoing.length > 0) {
    notice('session.swapDone', {
      item: displayName(result.item), from: result.fromContainer,
      stowed: result.outgoing.map(displayName).join(', '), to: result.stowedIn,
    })
  } else {
    notice('session.grabTaken', { item: displayName(result.item), from: result.fromContainer })
  }
  return { status: 'swapped' }
}
