// shared/combatGrabItem.js — « Prendre en main » : règles pures (client + serveur).
//
// Un objet du Sac ou de la Ceinture ne peut pas être utilisé (lancé, tiré, brandi) tant qu'il n'est pas en main.
// Ce module ne porte que les RÈGLES : coût de l'action selon le conteneur d'origine, objets tenables, choix
// d'une main libre. L'ÉTAT (où est l'objet) reste dans `inventoryService` (écriture par `updateItem`) ; le
// COÛT d'Initiative est agrégé par `shared/combatIniCost.js` (poste `grab`), l'exclusivité par
// `shared/combatExclusiveActions.js`. Même séparation autorité d'état / coût d'action que le modèle de port
// d'objet de Pathfinder 2e (foundryvtt/pf2e, `changeCarryType` ne facture aucune action).
// Plan : docs/Old/PLAN_PRISE_EN_MAIN.md.
//
// Règle de coût — décision de conception de Saar (2026-09-24), pas une lecture littérale du RAW (le livre ne
// définit pas Sac / Ceinture ; il donne « Saisir un objet : Initiative −3 à portée de main » et « Sortir un
// objet d'un sac : Action simple », REGLESYSCOMBAT.md) :
//   - Ceinture → Préparation, Initiative −3, cumulable avec toute autre action ;
//   - Sac      → Action simple : aucun coût d'Initiative, mais elle occupe l'action du Tour.

import { getSlotInfo, HAND_WEAPON_SLOTS } from './weaponSlots.js'
import { containerState, fitsInContainer, itemWeightKg } from './inventoryMath.js'

export const GRAB_SOURCE_CONTAINERS = Object.freeze(['Ceinture', 'Sac'])

export const GRAB_COST_BY_CONTAINER = Object.freeze({
  Ceinture: Object.freeze({ iniCost: -3, occupiesAction: false }),
  Sac:      Object.freeze({ iniCost: 0,  occupiesAction: true }),
})

/**
 * @param {string|null|undefined} container  `char_inventory.container` de l'objet
 * @returns {{ iniCost: number, occupiesAction: boolean } | null}  null si le conteneur n'est pas une source valide
 */
export function getGrabCost(container) {
  return GRAB_COST_BY_CONTAINER[container] ?? null
}

// Codes de refus d'une prise en main / permutation — VOCABULAIRE UNIQUE : le serveur en tire ses lignes de chat
// (combatGrabService), le client la raison d'une ligne grisée. Les valeurs sont figées (elles servent de clés de table).
export const GRAB_REFUSAL = Object.freeze({
  NOT_FOUND:             'not_found',             // objet introuvable ou n'appartenant pas au personnage
  NOT_CARRIED:           'not_carried',           // ni dans le Sac ni dans la Ceinture (Coffre, ou conteneur retiré)
  EQUIPPED:              'equipped',              // porté à un emplacement non-main (armure, contenant)
  NOT_HOLDABLE:          'not_holdable',          // pas tenable à la main (emplacement catalogue hors M / 2M / 2M/Tr)
  ALREADY_IN_HAND:       'already_in_hand',       // l'objet demandé est déjà en main
  NO_SAC:                'no_sac',                // règle PI2 : sans Sac à dos équipé, aucun objet ne peut être équipé en main
  HANDS_FULL:            'hands_full',            // aucune main libre (ou main prise entre le contrôle et l'écriture)
  CONTAINER_UNAVAILABLE: 'container_unavailable', // le conteneur de rangement n'est pas équipé
  NO_ROOM:               'no_room',               // l'objet sortant ne rentre pas dans son conteneur (R5, PLAN_PRISE_EN_MAIN.md)
  ARMOR_LAYERS:          'armor_layers',          // un bouclier entrant : couches d'armure de ses localisations pleines (règle 1+S+S)
})

/**
 * Un objet est tenable à la main si son emplacement catalogue est une main (`M`, boucliers compris : un objet à une main
 * comme un autre, décision Saar 2026-09-25), deux mains (`2M`) ou deux mains OU trépied (`2M/Tr`, traité comme `2M`). Le
 * trépied pur (`Tr`) et tout emplacement corporel / conteneur ne le sont pas. Autorité : `getSlotInfo` (shared/weaponSlots.js).
 *
 * @param {{ location?: string|null } | null | undefined} ref  ligne `ref_equipment`
 */
export function isGrabbableRef(ref) {
  if (!ref) return false
  const { type } = getSlotInfo(ref.location)
  return type === '1H' || type === '2M' || type === '2M_Tr'
}

// Un objet est « tenu » s'il occupe un emplacement de main (`MG` / `MD` / `2M` / `Tr`) — y compris dans le slot composite d'un
// bouclier (`['BG', 'C', 'MG']`). Un deux-mains (`2M`) ou une arme montée (`Tr`) engage les deux mains.
const HAND_SET = new Set(HAND_WEAPON_SLOTS)
const isHeld = (item) => (item?.slots ?? []).some(slot => HAND_SET.has(slot))
const handSlotsOf = (item) => (item?.slots ?? []).filter(slot => HAND_SET.has(slot))

/**
 * Classification STRUCTURELLE d'un objet demandé pour une prise en main / permutation — jamais les mains libres, le Sac ou la
 * capacité (ces motifs peuvent changer entre l'annonce et la résolution, `.claude/rules/combat.md`). AUTORITÉ UNIQUE, appelée
 * par `inventoryService.describeGrabCandidate` (annonce) et `swapItemInHand` (résolution, sur un instantané de l'inventaire).
 * Ordre des motifs : déjà en main, porté ailleurs, hors Sac / Ceinture, non tenable.
 *
 * @param {{ container?: string|null, slots?: string[]|null, refLocation?: string|null }} p
 * @returns {{ ok: true, alreadyInHand: boolean } | { ok: false, reason: string }}
 */
export function classifyGrabCandidate({ container, slots, refLocation }) {
  const carried = slots ?? []
  if (isHeld({ slots: carried })) return { ok: true, alreadyInHand: true }
  if (carried.length > 0) return { ok: false, reason: GRAB_REFUSAL.EQUIPPED }
  if (!getGrabCost(container)) return { ok: false, reason: GRAB_REFUSAL.NOT_CARRIED }
  if (!isGrabbableRef({ location: refLocation })) return { ok: false, reason: GRAB_REFUSAL.NOT_HOLDABLE }
  return { ok: true, alreadyInHand: false }
}

/**
 * Raisons pour lesquelles une prise en main ne peut PAS accompagner le reste de la déclaration (liste vide =
 * compatible). Seule une prise depuis le Sac (Action simple) est exclusive avec une autre Action de
 * combat ; depuis la Ceinture (Préparation), tout est permis. Le déplacement et les états annexes ne sont
 * pas des « Actions » au sens RAW ici (même choix que `getExoStandUpIneligibilityReasons`).
 *
 * @param {{ container: string, mapActions?: object }} p
 * @returns {string[]}  raisons en français direct (domaine combat, mêmes conventions que les autres listes)
 */
export function getGrabConflictReasons({ container, mapActions }) {
  const cost = getGrabCost(container)
  if (!cost || !cost.occupiesAction) return []
  const reasons = []
  if (Array.isArray(mapActions?.attack) && mapActions.attack.length > 0) reasons.push('tir')
  if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0) reasons.push('corps à corps')
  if (mapActions?.reload) reasons.push('rechargement')
  if (mapActions?.interact) reasons.push('interaction')
  return reasons
}

// ─── Permuter : quels objets sortent, dans quelle main entre l'objet (R6 / R7) ───────────────────────────────────────
//
// `planHandSwap` CHOISIT ; il ne VALIDE pas les emplacements. La validité (mains, deux-mains, Sac requis, composite d'un
// bouclier, couches d'armure) reste l'autorité UNIQUE de `inventoryService.applyItemUpdate` : un refus y annule la
// transaction (PLAN_PRISE_EN_MAIN.md, §2ter n° 9). Ici, uniquement le choix, identique pour l'aperçu client et la résolution.

/**
 * @param {object} p
 * @param {{ id: string, refLocation?: string|null }} p.incoming  l'objet à mettre en main (rangé au Sac / à la Ceinture)
 * @param {Array<{ id: string, slots?: string[]|null }>} p.items  l'inventaire du personnage (seuls `id` et `slots` servent ;
 *        « tenu » = un emplacement de main `MG` / `MD` / `2M` / `Tr`, y compris dans un slot composite de bouclier)
 * @param {string|null} [p.clickedItemId]  la ligne d'objet tenu sur laquelle « Permuter » a été cliqué ; `null` = « Mains nues »
 *        (une main libre reçoit l'objet). Une ligne qui n'est plus en main est ignorée : la main est libre, l'objet y entre.
 * @returns {{ ok: true, targetSlot: 'MD'|'MG'|'2M', outgoingIds: string[] } | { ok: false, reason: string }}
 *   `outgoingIds` : les objets tenus qui doivent d'abord être rangés, dans l'ordre de `items`.
 */
export function planHandSwap({ incoming, items, clickedItemId = null }) {
  if (!incoming) return { ok: false, reason: GRAB_REFUSAL.NOT_FOUND }
  const { type } = getSlotInfo(incoming.refLocation)
  if (type !== '1H' && type !== '2M' && type !== '2M_Tr') return { ok: false, reason: GRAB_REFUSAL.NOT_HOLDABLE }

  const held = (items ?? []).filter(isHeld)
  if (held.some(item => item.id === incoming.id)) return { ok: false, reason: GRAB_REFUSAL.ALREADY_IN_HAND }

  // R6 — deux mains (2M, 2M/Tr) : TOUT ce qui est tenu sort (armes, y compris montée sur trépied, et bouclier) ; l'arme
  // prend les deux mains. La ligne cliquée n'a pas d'importance.
  if (type !== '1H') return { ok: true, targetSlot: '2M', outgoingIds: held.map(item => item.id) }

  // R7 — une main, sur une ligne d'objet tenu : cet objet sort, l'entrant prend SA main. Un deux-mains (2M / Tr) libère
  // les deux mains : l'entrant prend la main directrice (MD d'abord, même convention que `resolveHandWeapons`).
  const clicked = clickedItemId ? held.find(item => item.id === clickedItemId) : null
  if (clicked) {
    const hands = handSlotsOf(clicked)
    const single = hands.length === 1 && (hands[0] === 'MG' || hands[0] === 'MD') ? hands[0] : 'MD'
    return { ok: true, targetSlot: single, outgoingIds: [clicked.id] }
  }

  // R7 — « Mains nues » : une main libre est requise (MD d'abord, puis MG) ; un deux-mains ou une arme montée occupe les deux.
  const occupied = new Set(held.flatMap(handSlotsOf))
  if (occupied.has('2M') || occupied.has('Tr')) return { ok: false, reason: GRAB_REFUSAL.HANDS_FULL }
  if (!occupied.has('MD')) return { ok: true, targetSlot: 'MD', outgoingIds: [] }
  if (!occupied.has('MG')) return { ok: true, targetSlot: 'MG', outgoingIds: [] }
  return { ok: false, reason: GRAB_REFUSAL.HANDS_FULL }
}

// ─── Permuter : où va l'objet sortant (R4 / R5 / R17) ────────────────────────────────────────────────────────────────

/**
 * Destination des objets sortants. v1 (décision Saar 2026-09-25) : SEUL le conteneur d'origine de l'objet entrant est
 * essayé (Ceinture ↔ Ceinture, Sac ↔ Sac) ; s'ils n'y rentrent pas, la permutation est REFUSÉE (`NO_ROOM`) — jamais le
 * Coffre, jamais un autre conteneur. C'est le POINT D'EXTENSION de la v2 (PLAN_OBJETS_AU_SOL.md : repli vers l'autre
 * conteneur, puis vers le sol) : ajouter un barreau ici, sans toucher à `swapItemInHand` ni à l'interface.
 *
 * @param {object} p
 * @param {'Sac'|'Ceinture'} p.origin  conteneur d'où vient l'objet entrant
 * @param {{ available: boolean, capacityKg: number|null, fillKg: number }} p.originState  `containerState(items, origin)`,
 *        objet entrant compris dans `fillKg` (il est encore rangé)
 * @param {Array<number|null|undefined>} p.outgoingKg  poids des objets sortants (absent = 0)
 * @param {number|null|undefined} p.incomingKg  poids de l'objet entrant (absent = 0)
 * @returns {{ ok: true, container: 'Sac'|'Ceinture' } | { ok: false, reason: string, container: 'Sac'|'Ceinture' }}
 */
export function planStowDestination({ origin, originState, outgoingKg, incomingKg }) {
  const outgoing = (outgoingKg ?? []).map(kg => kg ?? 0)
  // Rien à ranger (« Mains nues ») : aucune condition sur le conteneur.
  if (outgoing.length === 0) return { ok: true, container: origin }
  if (!originState?.available) return { ok: false, reason: GRAB_REFUSAL.CONTAINER_UNAVAILABLE, container: origin }
  const deltaKg = outgoing.reduce((sum, kg) => sum + kg, 0) - (incomingKg ?? 0)
  if (!fitsInContainer({ capacityKg: originState.capacityKg, fillKg: originState.fillKg, deltaKg })) {
    return { ok: false, reason: GRAB_REFUSAL.NO_ROOM, container: origin }
  }
  return { ok: true, container: origin }
}

// ─── Permuter : la DÉCISION complète, une seule fois ─────────────────────────────────────────────────────────────────

/**
 * Décision de permutation sur un inventaire : enchaîne, dans l'ordre, la classification de l'objet entrant, le Sac requis (R12),
 * le choix des objets sortants et de la main (`planHandSwap`) et la place du rangement (`planStowDestination`). AUTORITÉ UNIQUE
 * de « cette permutation est-elle possible, et que déplace-t-elle ? » : `inventoryService.swapItemInHand` l'appelle sur un
 * instantané lu DANS sa transaction (résolution), le client sur l'inventaire affiché (aperçu de la fenêtre de déclaration, jamais
 * l'autorité). Elle ne valide PAS les emplacements (mains prises entre-temps, couches d'armure d'un bouclier) : cette validité
 * reste celle d'`applyItemUpdate`, qui peut encore refuser à l'écriture.
 *
 * @param {object} p
 * @param {Array<object>} p.items  inventaire du personnage : `id`, `container`, `slots`, `quantity`, `ref_location`, `ref_weight`,
 *        `ref_capacity` (les champs d'`inventoryService.getInventory` ; le serveur en lit exactement ceux-là)
 * @param {string} p.incomingId  l'objet à mettre en main
 * @param {string|null} [p.clickedItemId]  la ligne d'objet tenu à remplacer ; `null` = « Mains nues »
 * @returns {{ status: 'planned', incomingId: string, targetSlot: 'MD'|'MG'|'2M', outgoingIds: string[],
 *             origin: 'Sac'|'Ceinture', stowContainer: 'Sac'|'Ceinture' }
 *         | { status: 'already' }
 *         | { status: 'refused', reason: string, container?: string, outgoingIds?: string[] }}
 *   `container` et `outgoingIds` n'accompagnent que `NO_ROOM` et `CONTAINER_UNAVAILABLE` (l'arme qui ne rentre pas, où).
 */
export function decideHandSwap({ items, incomingId, clickedItemId = null }) {
  const incoming = (items ?? []).find(item => item.id === incomingId)
  if (!incoming) return { status: 'refused', reason: GRAB_REFUSAL.NOT_FOUND }
  const verdict = classifyGrabCandidate({ container: incoming.container, slots: incoming.slots, refLocation: incoming.ref_location })
  if (!verdict.ok) return { status: 'refused', reason: verdict.reason }
  if (verdict.alreadyInHand) return { status: 'already' }
  // R12 : sans Sac à dos équipé, aucune permutation (règle PI2 de l'équipement, aussi vérifiée par applyItemUpdate).
  if (!containerState(items, 'Sac').available) return { status: 'refused', reason: GRAB_REFUSAL.NO_SAC }

  const swap = planHandSwap({ incoming: { id: incoming.id, refLocation: incoming.ref_location }, items, clickedItemId })
  if (!swap.ok) return { status: 'refused', reason: swap.reason }

  const origin = incoming.container
  const outgoing = swap.outgoingIds.map(id => items.find(item => item.id === id))
  const stow = planStowDestination({
    origin, originState: containerState(items, origin),
    outgoingKg: outgoing.map(itemWeightKg), incomingKg: itemWeightKg(incoming),
  })
  if (!stow.ok) return { status: 'refused', reason: stow.reason, container: stow.container, outgoingIds: swap.outgoingIds }
  return { status: 'planned', incomingId: incoming.id, targetSlot: swap.targetSlot, outgoingIds: swap.outgoingIds, origin, stowContainer: stow.container }
}
