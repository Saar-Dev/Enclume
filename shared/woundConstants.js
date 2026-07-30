import { MINUTES_PER_DAY } from './gameTime.js'

export const WOUND_LOCATIONS = [
  'tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche',
]

export const WOUND_SEVERITIES = ['legere', 'moyenne', 'grave', 'critique', 'mortelle']

export const WOUND_MAX_COUNTS = {
  tete:          { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  corps:         { legere: 4, moyenne: 3, grave: 3, critique: 2, mortelle: 2 },
  bras_droit:    { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  bras_gauche:   { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  jambe_droite:  { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
  jambe_gauche:  { legere: 3, moyenne: 3, grave: 2, critique: 2, mortelle: 1 },
}

// WNDMORT (docs/BUGIDENTIFIE.md) — REGLEBLESSURES.md, Blessures mortelles : « Malus aux Tests : non
// applicable, le blessé ne peut entreprendre aucune action demandant un Test. » `mortelle` n'a donc
// jamais de vraie valeur numérique (le -20 précédent était une extrapolation jamais confirmée par le
// LdB) — 0 ici uniquement en défense en profondeur (si un appelant futur oublie le garde
// `isTestBlockingWound`, il n'ajoute aucun malus fantôme, il n'en ajoute simplement aucun).
export const WOUND_PENALTIES = {
  legere: -1, moyenne: -3, grave: -5, critique: -10, mortelle: 0,
}

export const SEVERITY_COLORS = {
  legere: '#FFD700', moyenne: '#FFA500', grave: '#FF6B6B', critique: '#FF0000', mortelle: '#8B0000',
}

// Sévérités qui interdisent tout Test (predicate séparé du malus numérique — même principe que
// `shared/combatSituationMods.js` RANGED_SITUATION_MODS.impossible, TIRIMP docs/BUGIDENTIFIE.md).
export const TEST_BLOCKING_SEVERITIES = ['mortelle']

export function isTestBlockingWound(wounds) {
  return (wounds ?? []).some(w => TEST_BLOCKING_SEVERITIES.includes(w.severity))
}

// Localisations où même le Déplacement (Allure lente) reste impossible pour une Blessure mortelle —
// LdB « Effets » : Jambes = déplacement impossible ; Bras/Corps/Tête = déplacement Allure lente
// maximum autorisé. Décision Saar (2026-07-19) : seules Déplacement (Allure lente) et Passer le tour
// restent des actions valides pour un personnage mortellement blessé (aucune des deux ne demande de
// Test) — tout le reste (attaque, corps à corps, interaction, rechargement) reste interdit.
export const MORTAL_WOUND_IMMOBILE_LOCATIONS = ['jambe_droite', 'jambe_gauche']

export function isMortalWoundImmobilized(wounds) {
  return (wounds ?? []).some(w => w.severity === 'mortelle' && MORTAL_WOUND_IMMOBILE_LOCATIONS.includes(w.wound_location))
}

// Table RAW « Durée de guérison et soins nécessaires » (REGLEBLESSURES.md:413-433, vérifiée
// 2026-07-30 contre Polaris 3ème édition p.238 — voir docs/PLAN_BLESSURES_GUERISON.md §3.2).
// `legere` volontairement absente : guérit seule, sans Test, jamais d'échéance `wound_healing_check`.
// soinsConstants=true -> échéance récurrente hebdomadaire (Test de Médecine chaque semaine) ;
// false -> échéance unique, ponctuelle, à la fin de la durée.
// "Membre détruit" non modélisé (Option de campagne différée, docs/ROADMAP.md) — une Mortelle sur
// Bras/Jambe suit la ligne `mortelle` ci-dessous, pas une ligne séparée.
export const WOUND_HEALING = {
  moyenne:  { durationMinutes: 3 * MINUTES_PER_DAY,  soinsConstants: false },
  grave:    { durationMinutes: 7 * MINUTES_PER_DAY,  soinsConstants: false },
  critique: { durationMinutes: 21 * MINUTES_PER_DAY, soinsConstants: true },
  mortelle: { durationMinutes: 35 * MINUTES_PER_DAY, soinsConstants: true },
}

// Table RAW « Infection » (REGLEBLESSURES.md:436-472, vérifiée 2026-07-30 contre Polaris 3ème
// édition p.239-240, docs/PLAN_BLESSURES_GUERISON.md §3.3). `legere` absente : jamais concernée.
// caseMalus : -2 au Test par case déjà cochée sur la ligne (localisation/gravité), en plus de la
// première — RAW explicite sur Grave/Critique/Mortelle, absent du texte pour Moyenne (relecture
// attentive : la ligne Moyenne ne mentionne aucun malus de ce type, contrairement aux trois autres).
// periodMalus : -2 cumulatif par période de 2 jours passée sans soins corrects — RAW explicite
// seulement pour Grave (réussite) et Critique (échec) ; ni Moyenne ni Mortelle ne le mentionnent
// (Mortelle : la conséquence est un compte à rebours en heures, aucune "période suivante" réaliste).
export const WOUND_INFECTION = {
  moyenne:  { baseModifier: 5,   caseMalus: false, periodMalus: false, infectsOnSuccess: false },
  grave:    { baseModifier: 0,   caseMalus: true,  periodMalus: true,  infectsOnSuccess: false },
  critique: { baseModifier: -5,  caseMalus: true,  periodMalus: true,  infectsOnSuccess: true },
  mortelle: { baseModifier: -10, caseMalus: true,  periodMalus: false, infectsOnSuccess: true },
}
