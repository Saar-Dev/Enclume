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
