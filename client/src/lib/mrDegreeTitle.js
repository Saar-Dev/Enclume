import { getMrDegreeKey, getMrModifier } from '../../../shared/polarisTestResolution.js'

// Extrait de Sidebar.jsx (PLAN_REFACTOR_SIDEBAR.md, lot 2) — séparé de DiceBreakdownPopover.jsx car
// react-refresh/only-export-components interdit de mélanger export de composant et export de
// fonction utilitaire dans le même fichier.
//
// Tooltip explicatif du degré RAW (LdB p.203-204) associé à une marge de réussite/échec —
// undefined si mr absent (macro, /roll libre) ou Test de Choc (mécanique à deux seuils, pas de
// degré applicable, docs/PLANS/PLAN_TEST_CRITIQUE.md §9).
export function formatMrDegreeTitle(tCombat, mr, cardType) {
  if (mr == null || cardType === 'shock_test') return undefined
  const key = getMrDegreeKey(mr)
  if (!key) return undefined
  const modifier = getMrModifier(mr)
  const sign = modifier > 0 ? '+' : ''
  return `${tCombat(`degree.${key}`)} (${sign}${modifier})`
}
