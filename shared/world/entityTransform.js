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
