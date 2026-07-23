// shared/traitAggregation.js — Lot 6 (PLAN_WIZARD_AVANTAGES_IMPLANTATION.md §5bis) : agrège
// characterEffectTotals.traits (liste plate d'instructions {trait_type, op, value, note}, construite
// par creationService.js à partir des effets Revers + carrière déjà résolus, jamais accumulée entre
// deux appels de reconcileCreation) en gauges finales par trait_type.
//
// Fonction pure, extraite de creationService.js (Lot C) pour être testable comme le reste des
// résolveurs (careerAdvantages.js, setbackEffects.js) — même principe : logique métier en shared/,
// jamais uniquement dans le service serveur.
//
// Deux passes, nécessaires pour Diffamation/Trahison ("perd un quart de ses Alliés/Contacts", "un
// quart de sa Célébrité") : le résolveur (setbackEffects.js) est une fonction pure sans accès DB, il
// ne connaît jamais le total accumulé — seul l'agrégateur, qui voit TOUTES les instructions d'un
// coup, peut calculer la fraction. Un nouvel op `gauge_fraction_delta` (à côté de `gauge_delta`/
// `gauge_set` déjà existants) porte cette fraction (ex. -0.25 pour "un quart en moins").
//
// Décision (2026-07-22, peuplement Lot 6) : la fraction porte sur le gain BRUT du trait_type
// concerné (somme de tous les gauge_delta/gauge_set de ce trait_type, toutes sources confondues —
// carrières + autres Revers), jamais sur un total déjà réduit par une fraction précédente. Si deux
// Revers réduisant le même trait_type tombent dans le même reconcile (cas limite, aucune règle du
// jeu ne tranche l'ordre), chaque fraction s'applique indépendamment contre ce même gain brut,
// jamais en cascade — évite de dépendre d'un ordre de résolution arbitraire entre deux Revers.
// Même principe pour la Célébrité (applyFractionalLoss, ci-dessous), réutilisé par creationService.js
// pour characterEffectTotals.celebrity (pas de trait_type, juste un scalaire).

import { polarisRound } from './polarisUtils.js'

/**
 * @param {number} base — valeur avant réduction (gain brut, toutes sources confondues)
 * @param {number[]} fractionValues — ex. [-0.25, -0.5] (négatif = perte), chacune appliquée
 *   indépendamment contre `base`, jamais en cascade (voir décision ci-dessus)
 * @returns {number}
 */
export function applyFractionalLoss(base, fractionValues) {
  let total = base
  for (const value of fractionValues ?? []) total += polarisRound(base * value)
  return total
}

/**
 * @param {{trait_type:string, op:'gauge_delta'|'gauge_set'|'gauge_fraction_delta', value?:number, note?:string}[]} traitEffects
 * @returns {{gauges: Record<string, number>, notes: Record<string, string>}}
 */
export function aggregateTraitGauges(traitEffects) {
  const gauges = {}
  const notes = {}
  const fractionsByType = {}
  for (const t of traitEffects ?? []) {
    if (t.op === 'gauge_fraction_delta') {
      ;(fractionsByType[t.trait_type] ??= []).push(t.value)
      continue
    }
    if (t.op === 'gauge_set') gauges[t.trait_type] = t.value ?? 0
    else gauges[t.trait_type] = (gauges[t.trait_type] ?? 0) + (t.value ?? 0)
    // Accumulé, jamais écrasé : un même trait_type (ex. 'enemy') peut recevoir plusieurs notes
    // distinctes dans le même reconcile (ex. Ennemi important + Vendetta) — un seul champ note par
    // ligne char_traits, mais la concaténation évite qu'une note en efface silencieusement une autre
    // (trouvé en relecture critique, 2026-07-22 : write-last-wins perdait la distinction narrative).
    if (t.note && !(notes[t.trait_type] ?? '').includes(t.note)) {
      notes[t.trait_type] = notes[t.trait_type] ? `${notes[t.trait_type]}, ${t.note}` : t.note
    }
  }
  for (const [traitType, fractions] of Object.entries(fractionsByType)) {
    gauges[traitType] = applyFractionalLoss(gauges[traitType] ?? 0, fractions)
  }
  return { gauges, notes }
}
