// Table RAW « Chutes » (docs/REGLES/FATIGUE&DOMMAGES.md:14-30, vérifiée 2026-07-30 contre Polaris
// 3ème édition p.242, docs/PLAN_FATIGUE_DOMMAGES.md §9 Lot 3). Formules au format parseDice
// (`server/src/lib/diceParser.js`, `NdX` ou `NdX+M` — un seul type de dé, jamais deux formules
// additionnées), `locations` idem quand aléatoire (chaîne) ou nombre fixe.

// Cas spécial "Niveau du sol" — déclenché uniquement si le personnage courait à Allure maximale OU a
// obtenu une Catastrophe à un Test d'Acrobatie/Équilibre (RAW littéral). Jamais une hauteur 0 saisie
// par défaut : décision MJ narrative de déclencher ce cas précis, mutuellement exclusif avec
// `heightMeters` côté appelant (increment E).
export const FALL_DAMAGE_GROUND_LEVEL = { formula: '1d6', locations: 1 }

// Paliers 1-4m — valeurs RAW exactes, une entrée par hauteur (pas une table de plage : la RAW ne
// définit que ces 4 hauteurs précises, pas d'interpolation).
export const FALL_DAMAGE_TABLE = {
  1: { formula: '1d6',  locations: 1 },
  2: { formula: '1d10', locations: 1 },
  3: { formula: '2d10', locations: 1 },
  4: { formula: '3d10', locations: '1d3' },
}

// Au-delà de 4m — RAW littéral : "+1D10/mètre" ajouté à la base 3D10 du palier 4m, "1D3+3
// Localisation(s)" fixe quelle que soit la hauteur au-delà de 4m (pas une progression). La formule de
// dégâts se simplifie algébriquement en un seul type de dé — 3D10 + 1D10×(h-4) = (h-1)D10 pour h≥4
// (vérifié : h=4 → 3d10, identique au palier 4m ; h=5 → 4d10 = 3d10+1d10) — nécessaire techniquement
// puisque parseDice ne supporte qu'un seul type de dé par formule (pas de composé "3d10+1d10").
// Plafond narratif RAW "au-delà de 10D10 : dommages massifs..." (RAW elle-même vague/inachevée sur ce
// cas, une seule phrase, pas de table) : décision MJ pure, aucune limite numérique imposée ici — hors
// périmètre de ce lot (docs/PLAN_FATIGUE_DOMMAGES.md §9 "Hors périmètre").
export function fallDamageBeyondFourMeters(heightMeters) {
  return { formula: `${heightMeters - 1}d10`, locations: '1d3+3' }
}

// Terrain très accidenté/encombré (gravas, ferraille, tessons de verre) — RAW : +1D10 points,
// indépendant de la hauteur, ajouté une seule fois au total de dégâts bruts (pas par localisation :
// même total réutilisé aux N localisations touchées, point ouvert 1 du plan).
export const FALL_DAMAGE_TERRAIN_ACCIDENTE_BONUS = '1d10'

// Test d'Acrobatie/Équilibre — RAW : malus = hauteur × 2, réduction si réussite = 1D6 + mr, plancher 0.
// Au-delà de 5m (strictement), impossible de réduire les dégâts.
export const FALL_DAMAGE_TEST_MALUS_PER_METER = 2
export const FALL_DAMAGE_TEST_MAX_HEIGHT_METERS = 5
export const FALL_DAMAGE_TEST_REDUCTION_FORMULA = '1d6'
