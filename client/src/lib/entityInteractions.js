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
