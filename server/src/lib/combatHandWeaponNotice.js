// server/src/lib/combatHandWeaponNotice.js — R14 de docs/Old/PLAN_PRISE_EN_MAIN.md : une action qui dépend d'une arme déclarée
// à l'annonce mais plus en main à la résolution TOMBE, et le chat le dit.
//
// Causes réelles, toutes traitées de la même façon (une seule règle, pas une branche par cause) : la permutation du même Tour a été
// refusée (l'arme entrante n'est jamais arrivée en main), la permutation a rangé l'arme d'attaque, l'arme a été rangée depuis la
// fiche entre l'annonce et la résolution. Décision Saar (2026-09-25) : le personnage PERD son action, sans seconde chance ; l'Initiative
// payée à l'annonce n'est pas remboursée. Ce module ne décide de rien : il formule l'émission, chaque résolution (Tir, zone, corps à
// corps, rechargement) l'appelle à l'endroit où elle constate l'absence.
//
// Chat : message système + clé i18n résolue côté client (jamais de texte français émis ici, `rules/i18n.md`).

import { WS } from '../../../shared/events.js'
import { getItemWithRef } from '../services/inventoryService.js'

/** Nom affichable d'un objet d'inventaire (nom personnalisé, sinon nom du catalogue). */
export const itemDisplayName = (item) => item?.custom_name ?? item?.ref_name ?? '?'

const notice = (to, i18nKey, params, character) => ({
  ...(to === 'room'
    ? { to: 'room' }
    // Retour éphémère au propriétaire du personnage (PJ : son joueur ; PNJ : pas de user_id, repli sur le socket courant = le MJ).
    : { to: 'user', userId: character.user_id ?? null, fallback: 'socket' }),
  event: WS.COMBAT_SYSTEM_NOTICE,
  data: { i18nKey, params, timestamp: new Date().toISOString() },
})

/**
 * L'arme déclarée n'est plus en main : l'action qui en dépendait est annulée. Émission de chat pour toute la salle.
 * Le nom de l'arme est lu en base (best-effort) ; un objet introuvable ou qui n'appartient pas au personnage reçoit la variante
 * sans nom — jamais une résolution cassée pour un message.
 *
 * @param {{ id: string, name?: string|null }} character
 * @param {string|null} weaponInvId  la ligne d'inventaire déclarée
 * @param {{ loadItem?: typeof getItemWithRef }} [deps]
 */
export async function weaponNotInHandEmission(character, weaponInvId, { loadItem = getItemWithRef } = {}) {
  const label = character.name ?? '?'
  let item = null
  if (weaponInvId) {
    try {
      const found = await loadItem(weaponInvId)
      if (found?.character_id === character.id) item = found
    } catch (err) {
      // Identifiant mal formé (22P02) ou incident base : indiscernable d'un objet introuvable.
      console.error(`[WS] weaponNotInHandEmission — nom de l'arme introuvable item:${weaponInvId} : ${err.message}`)
    }
  }
  return item
    ? notice('room', 'session.actionCancelledWeaponNotInHand', { label, item: itemDisplayName(item) }, character)
    : notice('room', 'session.actionCancelledWeaponUnknown', { label }, character)
}

/**
 * La seconde arme (tir / corps à corps à deux armes) n'est plus en main : l'attaque continue avec l'arme principale seule, le bonus
 * « deux armes » est perdu. Ce n'est PAS un manque de munitions (`session.dualWieldAmmoOut*`) : d'où une clé dédiée.
 * Émission privée au propriétaire, même canal que les notices `dualWieldAmmoOut*`.
 */
export function offhandNotInHandEmission(character) {
  return notice('user', 'session.dualWieldOffhandNotInHand', { label: character.name ?? '?' }, character)
}
