// entityInteractions.js
// Calcule les interactions utilisables d'une entité posée, à l'instant courant.
//
// Frontière de lecture pour entity_blueprints.interactions : colonne jsonb sans contrainte de
// forme en base, alimentée par deux origines non validées à l'écriture (pipeline manifest via
// builtinModelCatalog.js, Atelier via entity-blueprints.js) — Array.isArray garde une interaction
// malformée silencieusement écartée plutôt qu'un crash de toute la session (vécu : Session Dev
// 2026-09-16, required_state_ids absent d'une entrée manifest).
export function getAvailableInteractions(entity) {
  const blueprint = entity?.blueprint
  const currentStateId = entity?.current_state_id ?? 0
  const disabledInteractions = entity?.disabled_interactions || []
  return (blueprint?.interactions || []).filter(interaction =>
    Array.isArray(interaction?.required_state_ids)
    && interaction.required_state_ids.includes(currentStateId)
    && !disabledInteractions.includes(interaction.id)
  )
}

// Difficulté effective d'une interaction (surcharge d'instance appliquée) — miroir de la formule de
// résolution serveur (socketEntity.js, ENTITY_ACTION_REQUEST/ENTITY_MOVE_REQUEST :
// `overrides.difficulty_dc ?? interaction.difficulty_dc ?? 0`), jamais une 2e autorité : sert
// uniquement à un aperçu client avant le jet (PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md L2), le serveur
// reste seul à trancher au moment du jet réel. Générique à toute interaction, pas seulement Déplacer.
export function getEffectiveInteractionDifficulty(entity, interaction) {
  const overrides = entity?.interaction_overrides?.[interaction?.id] || {}
  return overrides.difficulty_dc ?? interaction?.difficulty_dc ?? 0
}
