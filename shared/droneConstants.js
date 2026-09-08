// Seuils de dommages accumulés (Sprint 2 : application des malus)
export const DAMAGES_THRESHOLDS = {
  legere: 5, moyenne: 10, grave: 15, critique: 20, mortelle: 25, detruit: 30,
}

// Initialise le JSONB damages depuis WOUND_MAX_COUNTS[localisationRef]
// Utilisé à la création d'un drone_sheet (characters.js POST)
export function initDamages(localisationRef, woundMaxCounts) {
  const ref = woundMaxCounts[localisationRef] || woundMaxCounts['corps']
  return {
    legere:   Array(ref.legere).fill(false),
    moyenne:  Array(ref.moyenne).fill(false),
    grave:    Array(ref.grave).fill(false),
    critique: Array(ref.critique).fill(false),
    mortelle: Array(ref.mortelle).fill(false),
    detruit:  false,
  }
}

// La taille de cible (paliers + conversion depuis une dimension en cm) vit dans
// `shared/sizeCategory.js` (SIZE_CATEGORIES / sizeCategoryFromCm) — autorité transversale
// Character + Combat. L'ancien doublon `TAILLE_CIBLE_MODS` + `getTailleCible` a été retiré
// ici (docs/PLANS/PLAN_TAILLE.md S1).

// Localisations affichées en lecture seule dans DroneWindow (Sprint 2)
export const DRONE_LOCALISATION_LABELS = {
  generateur:           { range: [1, 1] },
  exosquelette:         { range: [2, 4] },
  structure:            { range: [5, 7] },
  armement:             { range: [8, 9] },
  systemes_auxiliaires: { range: [10, 10] },
}
