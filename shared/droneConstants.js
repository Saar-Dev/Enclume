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

export const TAILLE_CIBLE_MODS = {
  minuscule:   -10,
  tres_petite: -5,
  petite:      -3,
  moyenne:     0,
  grande:      +3,
  tres_grande: +5,
  enorme:      +10,
  gigantesque: +15,
}

// taille_cible n'est jamais stockée en base — toujours dérivée de drone_sheet.taille
export function getTailleCible(tailleCm) {
  if (tailleCm <= 35)  return 'minuscule'
  if (tailleCm <= 65)  return 'tres_petite'
  if (tailleCm <= 150) return 'petite'
  if (tailleCm <= 250) return 'moyenne'
  if (tailleCm <= 400) return 'grande'
  if (tailleCm <= 600) return 'tres_grande'
  if (tailleCm <= 850) return 'enorme'
  return 'gigantesque'
}

// Localisations affichées en lecture seule dans DroneWindow (Sprint 2)
export const DRONE_LOCALISATION_LABELS = {
  generateur:           { range: [1, 1] },
  exosquelette:         { range: [2, 4] },
  structure:            { range: [5, 7] },
  armement:             { range: [8, 9] },
  systemes_auxiliaires: { range: [10, 10] },
}
