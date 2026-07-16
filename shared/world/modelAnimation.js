const OPEN_STATE_PATTERN = /(^|[\s_-])(open(?:ed|ing)?|ouvert(?:e)?)(?=$|[\s_-]|action)/i

export function normalizeModelAnimationNames(names) {
  return [...new Set((Array.isArray(names) ? names : [])
    .map(name => String(name || '').trim())
    .filter(Boolean))]
}

export function modelHasOpenAnimation(names, explicitOpenable = false) {
  if (explicitOpenable) return true
  return normalizeModelAnimationNames(names).some(name => OPEN_STATE_PATTERN.test(name))
}

export function builtinOpenableStates(names, explicitOpenable = false) {
  if (!modelHasOpenAnimation(names, explicitOpenable)) return []
  return [
    { id: 0, key: 'closed', name: 'Fermé', visual_override: { animationProgress: 0 } },
    { id: 1, key: 'open', name: 'Ouvert', visual_override: { animationProgress: 1 } },
  ]
}

export function modelAnimationProgress(state) {
  const explicit = Number(
    state?.visual_override?.animationProgress
      ?? state?.visual_override?.animation_progress
      ?? state?.animationProgress
      ?? state?.animation_progress,
  )
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(1, explicit))
  const value = typeof state === 'string'
    ? state
    : (state?.key || state?.state || state?.name || '')
  return OPEN_STATE_PATTERN.test(String(value)) ? 1 : 0
}
