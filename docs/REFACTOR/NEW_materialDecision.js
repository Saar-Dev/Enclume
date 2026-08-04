// materialDecision.js — Décision de matériau pour les surfaces
// Extrait de surfaceData.js, Lot 1a du PLAN_REFACTOR_SURFACE.md

import {
  DEFAULT_SURFACE_MATERIAL_PRESET,
  makeProceduralMaterialDescriptor,
} from './proceduralMaterials.js'
import { hashString } from './surfaceUtils.js'

// ----- Constantes importées de surfaceData.js -----
const STATION_USED_PACK_ID = '6f3916a6-7c7b-45f7-a020-7d63b7a74176'
const STATION_USED_SPECIAL_RATE = 12

// ----- Décision de blocage -----

export function surfaceBlockingForTool(tool) {
  const type = tool?.surfaceBlocking || tool?.wallBlocking || 'solid'
  if (type === 'glass' || type === 'grate') {
    return {
      barrierType: type,
      blocksSight: false,
      blocksMovement: true,
      blocksWater: type !== 'grate',
    }
  }
  return {
    barrierType: 'solid',
    blocksSight: true,
    blocksMovement: true,
    blocksWater: true,
  }
}

// ----- Normalisation de preset -----

export function normalizeSurfaceMaterialPreset(tool) {
  return {
    ...DEFAULT_SURFACE_MATERIAL_PRESET,
    ...(tool?.materialPreset || tool?.proceduralMaterial || {}),
  }
}
export const normalizedSurfaceMaterial = normalizeSurfaceMaterialPreset

// ----- Fabrication de matériau procédural -----

export function makeSurfaceMaterial(tool, seed) {
  if (tool?.surfaceMaterialMode === 'texture') return null
  const preset = normalizeSurfaceMaterialPreset(tool)
  const variantSeed = tool?.autoVariants === false
    ? 'fixed'
    : `variant-${hashString(seed) % 4}`
  return makeProceduralMaterialDescriptor({
    ...preset,
    seed: `${preset.seed || DEFAULT_SURFACE_MATERIAL_PRESET.seed}:${variantSeed}`,
  })
}

// ----- Sélection de face -----

export function toolForMaterialFace(tool, face) {
  const preset = tool?.materialProfiles?.[face]
  if (!preset) return tool
  return { ...tool, materialPreset: preset }
}

// ----- Picking de texture -----

export function pickTextureVariant(baseTexId, availableBlocks, seed, autoVariants) {
  if (!baseTexId || !autoVariants) return baseTexId
  const base = availableBlocks?.find(block => block.id === baseTexId)
  if (!base?.category_id) return baseTexId

  const pool = availableBlocks
    .filter(block => !block.deprecated && block.category_id === base.category_id)
    .map(block => block.id)
  if (pool.length <= 1) return baseTexId

  return pool[hashString(seed) % pool.length] || baseTexId
}

function isStationFloorPackage(block) {
  const packName = String(block?.pack_name || '').toLowerCase()
  const packLabel = String(block?.pack_label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return packName === 'sol-station-use' || packLabel.includes('sol station')
}

function usesSparseSpecialVariants(pool) {
  if (!pool?.length) return false
  if (String(pool[0]?.pack_id) === STATION_USED_PACK_ID || isStationFloorPackage(pool[0])) return true

  const category = String(pool[0]?.category_label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const hasPrimary = pool.some(block => Number(block.sort_order) === 0)
  const hasSpecials = pool.length > 1
  const hasTrame = pool.some(block => String(block.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('trame'))
  return category === 'sol' && hasPrimary && hasSpecials && hasTrame
}

function textureVariantWeight(block) {
  const explicit = Math.max(1, Number.parseInt(block?.variant_weight, 10) || 1)
  const packName = String(block?.pack_name || '').toLowerCase()
  const packLabel = String(block?.pack_label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const label = String(block?.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  if (packName === 'sol-station-use' || packLabel.includes('sol station')) {
    if (label.includes('trame') || Number(block?.sort_order) === 0) return Math.max(explicit, 33)
    return 1
  }

  return explicit
}

export function pickTextureFromPackage(packId, availableBlocks, seed, autoVariants) {
  if (!packId) return null
  const pool = (availableBlocks || [])
    .filter(block => !block.deprecated && String(block.pack_id) === String(packId))
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || String(a.label).localeCompare(String(b.label)))
  if (pool.length === 0) return null
  if (!autoVariants || pool.length === 1) return pool[0].id

  if (usesSparseSpecialVariants(pool)) {
    const normal = pool.find(block => Number(block.sort_order) === 0) || pool[0]
    const specials = pool.filter(block => block.id !== normal.id)
    if (specials.length === 0) return normal.id
    const isSpecial = hashString(`${seed}:special-roll`) % STATION_USED_SPECIAL_RATE === 0
    if (!isSpecial) return normal.id
    return specials[hashString(`${seed}:special-choice`) % specials.length]?.id || normal.id
  }

  const weighted = pool.map(block => ({
    id: block.id,
    weight: textureVariantWeight(block),
  }))
  const totalWeight = weighted.reduce((sum, block) => sum + block.weight, 0)
  let ticket = hashString(seed) % totalWeight
  for (const block of weighted) {
    if (ticket < block.weight) return block.id
    ticket -= block.weight
  }
  return weighted[0]?.id || null
}

export function pickSurfaceTexture({ packId, textureId, fallbackTexId, availableBlocks, seed, autoVariants }) {
  const directPackTexture = pickTextureFromPackage(packId, availableBlocks, seed, autoVariants)
  if (directPackTexture) return directPackTexture

  const baseTexId = textureId || fallbackTexId
  const base = (availableBlocks || []).find(block => String(block.id) === String(baseTexId))
  const basePackTexture = pickTextureFromPackage(base?.pack_id, availableBlocks, seed, autoVariants)
  if (basePackTexture) return basePackTexture

  return pickTextureVariant(baseTexId, availableBlocks, seed, autoVariants)
}

// ----- Décision principale -----

export function materialOrTextureForTool({ tool, packId, textureId, fallbackTexId, availableBlocks, seed }) {
  if (textureId) {
    return {
      material: null,
      tex: pickSurfaceTexture({
        packId,
        textureId,
        fallbackTexId: null,
        availableBlocks,
        seed,
        autoVariants: tool?.autoVariants,
      }),
    }
  }

  const material = makeSurfaceMaterial(tool, seed)
  if (material) return { material, tex: null }

  if (fallbackTexId) {
    return {
      material: null,
      tex: pickSurfaceTexture({
        packId,
        textureId: null,
        fallbackTexId,
        availableBlocks,
        seed,
        autoVariants: tool?.autoVariants,
      }),
    }
  }

  return { material: null, tex: null }
}