import { DEFAULT_SURFACE_MATERIAL_PRESET } from './proceduralMaterials.js'

export function normalizedSurfaceMaterial(profile) {
  return { ...DEFAULT_SURFACE_MATERIAL_PRESET, ...(profile || {}) }
}
