// shared/combatIniCost.js — coût d'Initiative d'une déclaration de combat (Phase 1 ANNONCE).
//
// Autorité unique client + serveur du delta d'Initiative produit par une déclaration :
//   - serveur : socketCombatAnnouncement.js applique `computeIniDelta(...)` à
//     `combat_roster.initiative` au moment d'accepter la déclaration (calcul réel) ;
//   - client  : combatSections.js#calcIniDelta/calcIniBreakdown l'utilise pour l'aperçu affiché
//     dans le pied des fenêtres de déclaration (CombatDeclareIniWidget) — jamais un second calcul.
//
// Étend à TOUTES les transitions d'état le geste déjà fait pour la position
// (shared/combatStatePositionCost.js) et le Tir visé (shared/combatExclusiveActions.js#getAimIniCost) :
// plus aucune matrice de coût recopiée à la main entre client et serveur (CLAUDE.md §7, core.md,
// combat.md — pas de logique métier dupliquée client/serveur).
//
// RAW : REGLESYSCOMBAT.md (« POSITION DU PERSONNAGE », transitions d'arme, déplacement, actions
// rapides), LdB Polaris p.227-228 (modes de tir). Les drones sont hors de ce calcul (base_ini = 12
// immuable, LdB p.320) : l'appelant serveur garde son garde `if (!isDrone)`.

import { POSITION_TRANSITION_COST } from './combatStatePositionCost.js'
import { getAimIniCost } from './combatExclusiveActions.js'

// Coût d'Initiative des transitions d'état déclarées. 0 si `from === to` ou si la paire n'est pas
// listée. `position` est délégué à combatStatePositionCost.js (autorité déjà partagée).
// `cover` : flag défensif pur (il affecte les tireurs adverses en Phase 2 Résolution), aucun coût
// d'Initiative propre — matrice vide, conservée pour l'uniformité de la boucle.
export const STATE_TRANSITION_COST = {
  position: POSITION_TRANSITION_COST,
  weapon: {
    holstered: { ready:  -3, drawn: -5 },
    ready:     { holstered: -5, drawn: -3 },
    drawn:     { holstered: -10, ready: -3 },
  },
  fire_mode: {
    cc: { rc: -3, rl: -3 },
    rc: { cc: -3, rl: -3 },
    rl: { cc: -3, rc: -3 },
  },
  cover: {},
  vitesse: {
    delayed: { normal: 0, rushed: 3 },
    normal:  { delayed: 0, rushed: 3 },
    rushed:  { delayed: 0, normal: 0 },
  },
}

export const INI_STATE_KEYS = ['position', 'weapon', 'fire_mode', 'cover', 'vitesse']

// Coût d'une transition d'un champ d'état. `from`/`to` peuvent être absents (champ jamais renseigné) :
// on retourne 0, jamais une transition fantôme (même normalisation que le serveur `to = state[key] ?? from`).
export function stateTransitionCost(key, from, to) {
  if (!from || !to || from === to) return 0
  return STATE_TRANSITION_COST[key]?.[from]?.[to] ?? 0
}

/**
 * Détail du coût d'Initiative d'une déclaration, poste par poste — **primitif unique** : le total
 * (`computeIniDelta`) en est la somme, et le client construit le popover à partir des mêmes lignes.
 * Widget (total) et popover (détail) ne peuvent donc pas diverger. Les postes à coût nul sont omis
 * (rien à afficher, aucun effet sur la somme).
 *
 * @param {object} p
 * @param {{position?:string,weapon?:string,fire_mode?:string,cover?:string,vitesse?:string}} [p.prevStates]
 *        état tactique persisté AVANT la déclaration (`combat_roster.state_*`).
 * @param {{position?:string,weapon?:string,fire_mode?:string,cover?:string,vitesse?:string}} [p.nextStates]
 *        état déclaré — un champ absent = inchangé.
 * @param {?{ini_mod?:number}} [p.move]  déplacement déclaré (`mapActions.move`), ou null/undefined.
 * @param {?string} [p.combatMode]  mode de combat déclaré — `'charge'` / `'retraite'` rendent le
 *        déplacement gratuit (LdB : la Charge et la Retraite incluent leur déplacement).
 * @param {?{aimTranches?:number,lunetteNiveau?:number}} [p.aim]  Tir visé déclaré, ou null.
 * @param {?{observer?:number,reperer?:number,phrase?:boolean}} [p.quick]  actions rapides cumulables.
 * @returns {Array<{kind:string, key?:string, from?:string, to?:string, count?:number, value:number}>}
 *   `kind` ∈ `'state' | 'move' | 'aim' | 'observer' | 'reperer' | 'phrase'`. Le client résout un
 *   libellé i18n depuis `kind` (+ `key`/`from`/`to`/`count`) ; le serveur n'utilise que `value`.
 */
export function iniDeltaBreakdown({
  prevStates = {},
  nextStates = {},
  move = null,
  combatMode = null,
  aim = null,
  quick = null,
} = {}) {
  // `?? {}` en plus du défaut de déstructuration : celui-ci ne couvre que `undefined`, pas un
  // `null` explicite (payload client forgé) — l'autorité ne doit jamais lever sur une entrée absente.
  const prev = prevStates ?? {}
  const next = nextStates ?? {}
  const lines = []

  for (const key of INI_STATE_KEYS) {
    const from = prev[key]
    const to   = next[key] ?? from
    const value = stateTransitionCost(key, from, to)
    if (value !== 0) lines.push({ kind: 'state', key, from, to, value })
  }

  if (move) {
    const freeMove = combatMode === 'charge' || combatMode === 'retraite'
    const value = freeMove ? 0 : (move.ini_mod ?? 0)
    if (value !== 0) lines.push({ kind: 'move', value })
  }

  if (aim && (aim.aimTranches ?? 0) > 0) {
    const value = getAimIniCost(aim.aimTranches, { lunetteNiveau: aim.lunetteNiveau ?? 0 })
    if (value !== 0) lines.push({ kind: 'aim', count: aim.aimTranches, value })
  }

  if (quick) {
    const observer = quick.observer ?? 0
    const reperer  = quick.reperer  ?? 0
    if (observer > 0) lines.push({ kind: 'observer', count: observer, value: observer * -5 })
    if (reperer  > 0) lines.push({ kind: 'reperer',  count: reperer,  value: reperer  * -5 })
    if (quick.phrase) lines.push({ kind: 'phrase', value: -3 })
  }

  return lines
}

/**
 * Delta d'Initiative total d'une déclaration = somme du détail (`iniDeltaBreakdown`). Négatif ou nul
 * en règle générale ; seul `vitesse: 'rushed'` (« Précipiter ») ajoute +3. Résultat identique côté
 * client (aperçu) et serveur (appliqué à `combat_roster.initiative`).
 *
 * @param {Parameters<typeof iniDeltaBreakdown>[0]} params
 * @returns {number}
 */
export function computeIniDelta(params) {
  return iniDeltaBreakdown(params).reduce((sum, line) => sum + line.value, 0)
}

/**
 * Initiative finale projetée par une déclaration = Initiative courante + delta.
 *
 * Sur un tour frais, `combat_roster.initiative` a été remis à `base_ini` par `endTurn`
 * (socketCombatHelpers.js, correctif INI4 — REGLESYSCOMBAT p.213), donc le projeté est cohérent.
 *
 * `willBeLost` : une action entrant en Résolution avec une Initiative ≤ 0 est perdue
 * (`docs/SYSTEME/EXOARMURE.md` §5 ; `socketCombatHelpers.js#computeSeriesPositions`, `position <= 0`
 * → `'lost'`). Aperçu prudent, jamais une garantie : le serveur peut recalculer le coût de
 * déplacement depuis le chemin réellement emprunté (pathfinding) — à afficher comme signal visuel,
 * jamais comme blocage.
 *
 * @param {number} currentInitiative  `combat_roster.initiative` courant.
 * @param {number} delta  sortie de `computeIniDelta`.
 * @returns {{ projected:number, willBeLost:boolean }}
 */
export function projectedInitiative(currentInitiative, delta) {
  const projected = (currentInitiative ?? 0) + (delta ?? 0)
  return { projected, willBeLost: projected <= 0 }
}
