// shared/catastropheEffectTable.js — Table RAW "CATASTROPHES EN COMBAT" (Livre de Base Polaris
// p.219-220, docs/REGLES/REGLESYSCOMBAT.md:714-743), docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1.
//
// Donnée pure, indexée 1-10 (valeur du 1D10 RAW) — aucune logique dedans, même patron que MR_TABLE
// (shared/polarisTestResolution.js). Patron i18n identique à getMrDegreeKey : `key` est résolue en
// FR uniquement côté client (client/src/locales/combat.json, `combat.catastrophe.<key>.*`), jamais de
// texte français en dur ici — le serveur ne consomme jamais de texte destiné à l'utilisateur
// (.claude/rules/i18n.md).
//
// `mechanized` : false tant que Lot 2 (PLAN_CATASTROPHE_RISK.md §9) n'a pas câblé l'effet réel — une
// entrée non mécanisée reste un descripteur neutre affiché au MJ (catastropheService.js), jamais un
// effet appliqué silencieusement.
export const CATASTROPHE_EFFECT_TABLE = [
  { index: 1,  key: 'maladresse',          mechanized: false },
  { index: 2,  key: 'armeInutilisable',    mechanized: false },
  { index: 3,  key: 'mauvaiseCible',       mechanized: false },
  { index: 4,  key: 'oups',                mechanized: false },
  { index: 5,  key: 'positionDesavantageuse', mechanized: false },
  { index: 6,  key: 'confusion',           mechanized: false },
  { index: 7,  key: 'boum',                mechanized: false },
  { index: 8,  key: 'panneSysteme',        mechanized: false },
  { index: 9,  key: 'monOeil',             mechanized: false },
  { index: 10, key: 'desequilibre',        mechanized: false },
]

// findCatastropheEntry(index) — lookup pur, jamais un throw (même patron que
// findEcheanceRegistryEntry/findHazardRegistryEntry) : un index hors table (1-10) est une erreur
// appelant, pas une erreur de registre.
export function findCatastropheEntry(index) {
  return CATASTROPHE_EFFECT_TABLE.find(entry => entry.index === index)
}
