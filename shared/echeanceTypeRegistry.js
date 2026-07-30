// shared/echeanceTypeRegistry.js — Registre unique des types d'échéances de jeu (Lot 2,
// docs/PLAN_FATIGUE_DOMMAGES.md §8). Patron registre/lookup repris de shared/weaponModRegistry.js
// (Moding Groupe 4) — la moitié "dispatch" de weaponModService.js (RESOLVERS par hook, agrégation de
// plusieurs mods actifs) ne s'applique pas ici : chaque échéance n'invoque jamais qu'un seul handler,
// jamais d'agrégation ni de priorité entre entrées (correction 2026-07-30, voir §8 du plan).
// Vide en Lot 2 (socle) : peuplé par ses consommateurs (Blessures en premier,
// `wound_healing_check`/`wound_infection_check`, docs/PLAN_BLESSURES_GUERISON.md §5).
//
// Forme d'une entrée : { key, interactive, handler }
// - key : `condition_type` de la ligne `game_echeances`.
// - interactive : dénormalisé sur chaque ligne `game_echeances` à sa création (filtre direct de
//   balayage) — ce registre reste la seule source de vérité, jamais déduit d'ailleurs.
// - handler(trx, echeance, context) : retourne { resolved: true, effects, reschedule, spawn,
//   undoEntries } ou { resolved: false } (uniquement valide si interactive: true) — contrat complet
//   dans docs/PLAN_FATIGUE_DOMMAGES.md §8.
export const ECHEANCE_TYPE_REGISTRY = []

// condition_type inconnu → undefined, jamais une erreur — sweepDueEcheances/resolveEcheanceNow
// doivent rester neutres (ou lever une erreur métier explicite de leur côté) plutôt que planter sur
// une entrée de registre manquante, même patron que findModRegistryEntry.
export function findEcheanceRegistryEntry(conditionType) {
  return ECHEANCE_TYPE_REGISTRY.find(entry => entry.key === conditionType)
}
