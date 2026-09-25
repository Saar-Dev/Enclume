// shared/chanceRules.js — règles PURES de la réserve de Chance (docs/REGLES/REGLE_CHANCE.md), autorité unique du plancher.
//
// `char_sheet.chc` est à la fois le score et la réserve dépensable (docs/PLANS/PLAN_CHANCE.md). RAW : un personnage descendu à
// 3 ne peut plus en dépenser — « chc − coût ≥ 3 ». Cette règle vivait dans `chanceService.js` (écriture) ; elle est lue aussi
// avant d'OUVRIR une réaction (« a-t-il de quoi payer ? »), d'où sa place ici : une seule définition, jamais recopiée.

export const CHC_FLOOR = 3
export const CHC_CEIL = 20

// Vrai si dépenser `n` points laisse au moins CHC_FLOOR points. `chc` absent/non numérique : jamais dépensable.
export function canSpendChance(chc, n) {
  return Number.isFinite(chc) && Number.isFinite(n) && chc - n >= CHC_FLOOR
}
