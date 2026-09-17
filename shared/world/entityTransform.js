export const ENTITY_SCALE_MIN = 0.25
export const ENTITY_SCALE_MAX = 4
export const ENTITY_SCALE_STEP = 0.05

export function normalizeEntityScale(state, fallback = 1) {
  const raw = state?.transform?.scale ?? state?.scale
  const value = Number(raw)
  const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : 1
  return Math.max(
    ENTITY_SCALE_MIN,
    Math.min(ENTITY_SCALE_MAX, Number.isFinite(value) ? value : safeFallback),
  )
}

export function withEntityScale(state, scale) {
  const source = state && typeof state === 'object' && !Array.isArray(state) ? state : {}
  return {
    ...source,
    transform: {
      ...(source.transform && typeof source.transform === 'object' ? source.transform : {}),
      scale: normalizeEntityScale({ transform: { scale } }),
    },
  }
}

// Surcharge par instance d'une interaction de blueprint (entities.interaction_overrides, jsonb sans
// contrainte de forme en base — PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md L1). Autorité unique de
// nettoyage, réutilisée par la route d'écriture (server/src/routes/entities.js) et par l'aperçu
// optimiste du panneau d'instance (EntityInstancePanel.jsx) : un id d'interaction absent du
// blueprint ou une valeur non finie sont silencieusement écartés plutôt que persistés (même exigence
// que `lockDifficultyDc` dans shared/world/surfaceDocument.js pour les portes).
export function normalizeInteractionOverrides(overrides, blueprintInteractions = []) {
  const validIds = new Set((blueprintInteractions || []).map(i => i?.id).filter(Boolean))
  const source = overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : {}
  const result = {}
  for (const [id, patch] of Object.entries(source)) {
    if (!validIds.has(id) || !patch || typeof patch !== 'object' || Array.isArray(patch)) continue
    const clean = {}
    if (patch.difficulty_dc != null) {
      const n = Number(patch.difficulty_dc)
      if (Number.isFinite(n)) clean.difficulty_dc = n
    }
    if (patch.range != null) {
      const n = Number(patch.range)
      if (Number.isFinite(n) && n > 0) clean.range = n
    }
    if (Object.keys(clean).length > 0) result[id] = clean
  }
  return result
}
