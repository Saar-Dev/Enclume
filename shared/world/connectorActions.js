// shared/world/connectorActions.js
//
// Décision pure "que fait une action de porte, selon l'état effectif actuel" — extraite hors de
// `socketConnector.js` (couplé DB, donc pas testable en isolation) pour que cette matrice de
// décision (docs/PLANS/PLAN_INTERACTIONS_CONNECTEURS.md §4 points 4-6) ait un test dédié, pas
// seulement des conditions inline vérifiées par lecture.

// action ∈ 'open' | 'close' (jamais 'lock' ici — réservé à l'override MJ, qui ne passe pas par
// cette matrice). effectiveState ∈ 'open' | 'closed' | 'locked'.
// Retour : 'noop' (rien à faire) | 'free' (action libre, pas de Test) | 'test' (Systèmes de
// sécurité requis) | null (combinaison inconnue — jamais devinée).
export function resolveDoorActionOutcome(action, effectiveState) {
  if (action === 'open') {
    if (effectiveState === 'open') return 'noop'
    if (effectiveState === 'closed') return 'free'
    if (effectiveState === 'locked') return 'test'
  } else if (action === 'close') {
    // Une porte verrouillée est par définition fermée (RAW) — "fermer" une porte déjà locked/closed
    // ne fait jamais rien, jamais une erreur.
    if (effectiveState === 'closed' || effectiveState === 'locked') return 'noop'
    if (effectiveState === 'open') return 'free'
  }
  return null
}
