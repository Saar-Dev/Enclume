// shared/fatigueConstants.js — Compteur de Fatigue RAW (docs/REGLES/FATIGUE&DOMMAGES.md:838-1017,
// Annexe p.250 capturée par Saar 2026-07-30, docs/PLAN_FATIGUE_DOMMAGES.md §10 Lot 4). Un seul entier
// persistant (char_sheet.fatigue_points, 0 à 17) encode 6 paliers × 3 cases — palier = floor(points/3),
// case = points%3. Deux malus indépendants, jamais confondus :
// - FATIGUE_LEVEL_MALUS (par palier) s'applique à TOUS les Tests du personnage SAUF ses propres Tests
//   de Fatigue (RAW ligne 976-979, exemption explicite).
// - FATIGUE_TEST_MALUS/FATIGUE_CHOC_MALUS (par case) s'applique UNIQUEMENT au prochain Test de
//   Fatigue (paliers 0-4) ou Test de Choc de remplacement (palier 5, "À bout de force").

export const MAX_FATIGUE_POINTS = 17

// Index = palier (0 = Normal ... 5 = À bout de force). Barème RAW p.243, décision Lot 0 §4.1.
export const FATIGUE_LEVEL_MALUS = [0, -3, -5, -7, -10, -10]

// Index = case (0-2), paliers 0-4 — malus au prochain Test de Fatigue (Annexe p.250).
export const FATIGUE_TEST_MALUS = [0, -5, -10]

// Index = case (0-2), palier 5 uniquement — malus au Test de Résistance au Choc qui remplace le Test
// de Fatigue à ce palier (Annexe p.250, colonne "À bout de force").
export const FATIGUE_CHOC_MALUS = [-5, -10, -15]

export function getFatiguePalier(points) {
  return Math.min(5, Math.floor(points / 3))
}

export function getFatigueCase(points) {
  return points - getFatiguePalier(points) * 3
}

export function getFatigueLevelMalus(points) {
  return FATIGUE_LEVEL_MALUS[getFatiguePalier(points)]
}

// Sélectionne la bonne table selon le palier — RAW p.243 : au palier 5 le Test de Fatigue est
// remplacé par un Test de Choc, avec sa propre table de malus par case.
export function getFatigueTestMalus(points) {
  const palier = getFatiguePalier(points)
  const c = getFatigueCase(points)
  return palier === 5 ? FATIGUE_CHOC_MALUS[c] : FATIGUE_TEST_MALUS[c]
}
