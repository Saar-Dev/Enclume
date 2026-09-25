// client/src/lib/declaredSwap.js — « Permuter » dans les fenêtres de déclaration de combat : l'inventaire TEL QU'IL SERA une fois la
// permutation déclarée résolue, et l'avertissement à afficher si elle sera refusée. Fonctions PURES (testées).
// Plan : docs/Old/PLAN_PRISE_EN_MAIN.md, Lot B.
//
// AUCUNE règle n'est écrite ici : la décision (quel objet sort, dans quelle main, où il se range, ce qui est refusé) est
// `shared/combatGrabItem.js#decideHandSwap`, la même fonction que le serveur exécute à la résolution. Ce module ne fait que
// PROJETER cette décision sur la liste d'objets affichée. C'est une PRÉVISUALISATION (`.claude/rules/react.md`) : le serveur ne
// reprend jamais cette version, il relit l'inventaire réel à la résolution et peut encore refuser (main prise entre-temps,
// couches d'armure d'un bouclier — ce que le client ne sait pas prévoir : il n'en duplique pas la règle).

import { decideHandSwap, GRAB_REFUSAL } from '../../../shared/combatGrabItem.js'
import { initialMagazineOnEquip } from '../../../shared/ammoRules.js'
import { flattenItemsBySlot, HAND_WEAPON_SLOTS } from '../../../shared/weaponSlots.js'

/**
 * @typedef {object} DeclaredSwap
 * @property {string} itemId              l'objet du Sac / de la Ceinture à mettre en main
 * @property {string|null} replaceItemId  la ligne d'objet tenu sur laquelle « Permuter » a été cliqué ; `null` = « Mains nues »
 */

/**
 * L'inventaire effectif après la permutation déclarée : l'objet entrant est en main (dans la main que la décision désigne), les
 * objets sortants sont rangés dans le conteneur d'origine de l'entrant. Les objets rangés reprennent la forme du serveur :
 * `slots: null` (un tableau vide n'existe pas côté serveur, `array_agg` sans ligne vaut NULL — le filtre des munitions et
 * `buildGrabList` en dépendent). L'entrant équipé pour la première fois reçoit le chargeur plein de R16
 * (`initialMagazineOnEquip`, la règle même que le serveur écrit) : l'aperçu ne l'affiche pas « vide » à tort.
 *
 * Sans permutation, ou si elle sera refusée / est sans effet (déjà en main) : l'inventaire de base, MÊME RÉFÉRENCE (une identité
 * stable évite de relancer les effets qui en dépendent). Les slots composites d'un bouclier (bras, localisations) ne sont pas
 * recomposés : l'entrant reçoit sa main seule — assez pour l'affichage, `applyItemUpdate` compose le reste à l'écriture.
 *
 * @param {ReadonlyArray<object>} items  inventaire chargé (`GET /char-sheet/:id/inventory` → `items`)
 * @param {DeclaredSwap|null} swap
 * @returns {{ items: ReadonlyArray<object>, decision: ReturnType<typeof decideHandSwap> | null }}
 */
export function applyDeclaredSwap(items, swap) {
  if (!swap?.itemId) return { items, decision: null }
  const decision = decideHandSwap({ items, incomingId: swap.itemId, clickedItemId: swap.replaceItemId ?? null })
  if (decision.status !== 'planned') return { items, decision }

  const outgoing = new Set(decision.outgoingIds)
  const effective = items.map((item) => {
    if (item.id === decision.incomingId) {
      // Même condition que le serveur (`applyItemUpdate` : `ammo_remaining === null`) — jamais un chargeur réécrit.
      const magazine = item.ammo_remaining === null ? initialMagazineOnEquip(item.ref_caliber, item.ref_ammo_count) : null
      return { ...item, slots: [decision.targetSlot], container: 'Sac', ammo_remaining: magazine ?? item.ammo_remaining }
    }
    if (outgoing.has(item.id)) return { ...item, slots: null, container: decision.stowContainer }
    return item
  })
  return { items: effective, decision }
}

/**
 * L'avertissement à afficher pour une permutation choisie, ou `null` si rien à signaler. Information seulement : la ligne reste
 * cliquable, la déclaration reste possible (décision Saar 2026-09-25 — le joueur assume, et si l'aperçu se trompe il ne bloque pas
 * une permutation valide) ; le serveur tranche à la résolution et le chat le dit.
 *
 * Les codes sont ceux de `GRAB_REFUSAL` (vocabulaire unique serveur / client) : la fenêtre en tire son texte.
 *
 * @param {ReadonlyArray<object>} items  inventaire de BASE (avant permutation)
 * @param {DeclaredSwap|null} swap
 * @returns {{ reason: string, container?: string, itemName?: string } | null}
 *   `container` et `itemName` (le ou les objets sortants, séparés par une virgule) n'accompagnent que « ne rentre pas » et
 *   « conteneur non équipé » : de quoi écrire « X ne rentre pas dans la Ceinture ».
 */
export function swapWarning(items, swap) {
  if (!swap?.itemId) return null
  const decision = decideHandSwap({ items, incomingId: swap.itemId, clickedItemId: swap.replaceItemId ?? null })
  if (decision.status === 'planned') return null
  if (decision.status === 'already') return { reason: GRAB_REFUSAL.ALREADY_IN_HAND }
  if (!decision.container) return { reason: decision.reason }
  const names = (decision.outgoingIds ?? [])
    .map(id => items.find(item => item.id === id))
    .map(item => item?.custom_name || item?.ref_name || '?')
  return { reason: decision.reason, container: decision.container, itemName: names.join(', ') }
}

/**
 * Objets en main auxquels la liste des actions n'a AUCUNE ligne : le bouclier, une grenade sans profil de zone… La liste
 * Distance / Contact ne montre que ce qui peut attaquer ; ces objets tenus n'apparaîtraient nulle part, et sans ligne on ne
 * pourrait pas les permuter (« Permuter » se clique sur la ligne de l'objet à remplacer). Une ligne par objet, dans l'ordre des
 * mains (`MG`, `MD`, `2M`, `Tr`) ; un bouclier (slot composite) se lit par sa main.
 *
 * @param {ReadonlyArray<object>} items  inventaire (effectif)
 * @param {Iterable<string>} listedIds  identifiants déjà présents dans la liste des actions (Distance ∪ Contact)
 * @returns {Array<object>}  lignes d'inventaire, chacune avec `slot` = sa main
 */
export function heldItemsWithoutActionRow(items, listedIds) {
  const listed = new Set(listedIds)
  const seen = new Set()
  const rows = []
  for (const row of flattenItemsBySlot(items)) {
    if (listed.has(row.id) || seen.has(row.id)) continue
    seen.add(row.id)
    rows.push(row)
  }
  return rows.sort((a, b) => HAND_WEAPON_SLOTS.indexOf(a.slot) - HAND_WEAPON_SLOTS.indexOf(b.slot))
}
