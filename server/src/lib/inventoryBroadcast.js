// server/src/lib/inventoryBroadcast.js — « à qui diffuser » un événement d'inventaire : UNE autorité.
//
// Extrait de routes/character/char-sheet.js (docs/Old/PLAN_PRISE_EN_MAIN.md, Lot A2) : la route PUT inventaire, la résolution
// d'une permutation en combat (combatGrabService) et le retrait d'une grenade lancée (consumeThrownGrenade) diffusent les mêmes
// événements INVENTORY_* — ils choisissent donc la salle par la même fonction, jamais chacun la sienne. Comportement inchangé.
import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'

// Portée de diffusion inventaire (docs/PLAN_WIZARD_MATERIEL.md §2) : tant que le personnage est un
// brouillon actif (Wizard non terminé), diffuser à wizard:<sheetId> plutôt qu'à toute la room de
// campagne — même principe déjà posé pour les verrous/l'état du Wizard
// (docs/PLAN_WIZARDCOLLAB.md §2.1, "diffusion scopée par ressource, jamais toute la campagne") :
// un membre de la campagne non impliqué dans cette session Wizard ne doit pas apprendre qu'un
// brouillon existe. Comportement inchangé (room de campagne) pour un personnage fini, en jeu réel.
// Un personnage du Coffre (campaign_id NULL, wizard_locked_at posé dès la création —
// charSheetService.js) n'a personne à notifier — même invariant que PUT /sols (2026-08-16) : retourne
// explicitement null plutôt que de laisser passer un campaignId déjà NULL vers `.to(room).emit()`.
// `emitInventoryEvent` saute l'émission dans ce cas, centralisé une fois pour tous les appelants
// plutôt qu'un `if (room)` dupliqué à chacun (ticket COFFRE-INVROOM1).
export async function resolveInventoryBroadcastRoom(characterId, campaignId) {
  const sheet = await db('char_sheet').where({ character_id: characterId }).first()
  if (sheet && !sheet.wizard_locked_at) return `wizard:${sheet.id}`
  return campaignId || null
}

export function emitInventoryEvent(io, room, event, payload) {
  if (room) io.to(room).emit(event, payload)
}

/**
 * Résout la salle puis émet : le raccourci des appelants qui n'ont pas déjà la salle (le combat).
 *
 * @param {import('socket.io').Server} io
 * @param {string} characterId
 * @param {string|null} campaignId
 * @param {'INVENTORY_ADDED'|'INVENTORY_UPDATED'|'INVENTORY_REMOVED'} eventName  clé de `WS`
 * @param {object} payload  sans `characterId` (ajouté ici, comme le contrat des événements INVENTORY_*)
 */
export async function broadcastInventoryEvent(io, characterId, campaignId, eventName, payload) {
  const room = await resolveInventoryBroadcastRoom(characterId, campaignId)
  emitInventoryEvent(io, room, WS[eventName], { characterId, ...payload })
}
