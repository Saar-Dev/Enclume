// surfaceUtils.js — Fonctions utilitaires partagées du module surface
// Extrait de surfaceData.js, Lot 1a du PLAN_REFACTOR_SURFACE.md

/**
 * Hash FNV-1a 32 bits (version surfaceData.js).
 * Conservée séparément de la version proceduralMaterials.js pour éviter
 * tout changement de seeds des matériaux procéduraux.
 */
export function hashString(value) {
  let hash = 2166136261
  const str = String(value)
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 2246822507)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 3266489909)
  hash ^= hash >>> 16
  return hash >>> 0
}

export function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

export function formatLevel(value) {
  const rounded = Math.round((Number(value) || 0) * 1000) / 1000
  if (Object.is(rounded, -0)) return '0'
  return String(rounded)
}

export function sameLevel(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.001
}