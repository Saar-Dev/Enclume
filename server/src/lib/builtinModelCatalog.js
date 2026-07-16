import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/knex.js'
import {
  builtinOpenableStates,
  modelHasOpenAnimation,
  normalizeModelAnimationNames,
} from '../../../shared/world/modelAnimation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const BUILTIN_MODELS_ROOT = path.resolve(__dirname, '..', '..', '..', 'output')

function friendlyName(asset) {
  const label = asset.label
    || asset.name.replace(/^\d+_/, '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
  return asset.connector_type === 'skylight'
    ? label.replace(/^Verri[eè]re/i, 'Dalle en verre')
    : label
}

function futuristicDoorBorder(asset) {
  const name = String(asset?.name || '').toLowerCase()
  if (name.includes('02_airlock')) return 0.23
  if (name.includes('06_large_hangar')) return 0.34
  if (name.includes('07_large_glass_hangar')) return 0.38
  if (name.includes('08_three_part')) return 0.2
  if (name.includes('door') || name.includes('hatch')) return 0.18
  return 0
}

function normalizePlacementMode(value, packName) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'wall' || raw === 'connector' || raw === 'free') return raw
  return packName === 'futuristic_doors' ? 'connector' : 'free'
}

function friendlySlotLabel(value) {
  return String(value || 'Couleur')
    .replace(/^SLOT_/i, '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function editorMaterialSlots(asset) {
  const explicit = Array.isArray(asset.editor_color_slots) ? asset.editor_color_slots : []
  const legacy = explicit.length === 0 && Array.isArray(asset.color_slots) ? asset.color_slots : []
  const source = explicit.length > 0 ? explicit : legacy
  return source.flatMap((slot, index) => {
    if (slot?.recolorable === false) return []
    const slotName = String(slot?.slot || slot?.id || `slot_${index + 1}`).trim()
    const code = String(slot?.code || (explicit.length > 0 ? `SLOT_${String(index + 1).padStart(2, '0')}` : `SLOT_${slotName}`)).toUpperCase()
    const materialNames = Array.isArray(slot?.material_names)
      ? slot.material_names
      : (slot?.material ? [slot.material] : [])
    if (materialNames.length === 0) return []
    return [{
      id: slot?.id || slotName,
      code,
      label: slot?.label || friendlySlotLabel(slotName),
      defaultHex: slot?.default_hex || '#ffffff',
      transparent: Boolean(slot?.transparent || /glass|verre|vitre/i.test(slotName)),
      materialNames,
    }]
  })
}

function glbAnimationNames(filePath) {
  try {
    const bytes = fs.readFileSync(filePath)
    if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF') return []
    let offset = 12
    while (offset + 8 <= bytes.length) {
      const length = bytes.readUInt32LE(offset)
      const type = bytes.toString('ascii', offset + 4, offset + 8)
      if (type === 'JSON') {
        const document = JSON.parse(bytes.toString('utf8', offset + 8, offset + 8 + length).replace(/[\0\s]+$/, ''))
        return normalizeModelAnimationNames((document.animations || []).map(animation => animation?.name))
      }
      offset += 8 + length
    }
  } catch (error) {
    console.warn(`Animations GLB illisibles pour ${filePath}:`, error.message)
  }
  return []
}

function dimensions(asset, packName, manifest = {}, animationNames = []) {
  const doorPanelWidth = Number(asset.door_panel_width_m || 0)
  const doorPanelHeight = Number(asset.door_panel_height_m || 0)
  const border = packName === 'futuristic_doors' ? futuristicDoorBorder(asset) : 0
  const width = Number(asset.footprint_width_m ?? (doorPanelWidth ? doorPanelWidth + border * 2 : 1))
  const wallCutWidth = Number(asset.wall_cut_width_m ?? asset.wallCutWidth ?? width)
  const height = Number(asset.height_m ?? asset.door_panel_height_m ?? 1)
  const hasAssetPlacementMode = asset.placement_mode !== undefined
  const placementMode = normalizePlacementMode(
    hasAssetPlacementMode ? asset.placement_mode : manifest.placement_mode_default,
    packName,
  )
  const defaultOrigin = placementMode === 'wall' ? 'wall-back-center' : 'floor-center'
  const geometry = {
    width,
    depth: Number(asset.footprint_depth_m ?? (packName === 'futuristic_doors' ? 0.35 : 1)),
    height,
    placementMode,
    origin: asset.origin || (!hasAssetPlacementMode ? manifest.origin_default : null) || defaultOrigin,
  }
  if (asset.connector_type) geometry.connectorType = String(asset.connector_type)
  if (Number.isFinite(Number(asset.opening_bottom_m))) geometry.openingBottom = Number(asset.opening_bottom_m)
  if (Number.isFinite(Number(asset.opening_width_m))) geometry.openingWidth = Number(asset.opening_width_m)
  if (Number.isFinite(Number(asset.wall_cut_width_m))) geometry.wallCutWidth = Number(asset.wall_cut_width_m)
  if (Number.isFinite(Number(asset.wall_cut_height_m))) geometry.wallCutHeight = Number(asset.wall_cut_height_m)
  if (Number.isFinite(Number(asset.span_levels))) geometry.spanLevels = Number(asset.span_levels)
  if (Array.isArray(asset.allowed_states)) geometry.allowedStates = asset.allowed_states.map(String)
  if (asset.skylight_size) geometry.skylightSize = String(asset.skylight_size)
  if (animationNames.length > 0) geometry.animationClips = animationNames
  const explicitOpenable = Boolean(asset.openable || asset.animation || asset.opening || asset.animation_frame_open)
  if (modelHasOpenAnimation(animationNames, explicitOpenable)) geometry.openable = true
  const wallMount = asset.wall_mount || manifest.wall_mount_default
  if (placementMode === 'wall' && wallMount && typeof wallMount === 'object') {
    geometry.wallMount = {
      defaultBottomHeight: Number(wallMount.default_bottom_height ?? wallMount.defaultBottomHeight ?? 1),
      allowInterior: wallMount.allow_interior !== false && wallMount.allowInterior !== false,
      allowExterior: wallMount.allow_exterior !== false && wallMount.allowExterior !== false,
    }
  }
  if (packName === 'futuristic_doors' && doorPanelWidth) {
    geometry.openingWidth = doorPanelWidth
    geometry.openingHeight = doorPanelHeight || height
    geometry.wallCutWidth = wallCutWidth
  }
  const materialSlots = editorMaterialSlots(asset)
  if (materialSlots.length > 0) geometry.materialSlots = materialSlots
  return geometry
}

export function readBuiltinModels() {
  const models = []
  const packNames = fs.readdirSync(BUILTIN_MODELS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(BUILTIN_MODELS_ROOT, entry.name, 'manifest.json')))
    .map(entry => entry.name)
    .sort()
  for (const packName of packNames) {
    const manifestPath = path.join(BUILTIN_MODELS_ROOT, packName, 'manifest.json')
    if (!fs.existsSync(manifestPath)) continue
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    for (const asset of manifest.assets || []) {
      const fileName = asset.catalog_file || `${asset.name}.glb`
      const filePath = path.join(BUILTIN_MODELS_ROOT, packName, 'glb', fileName)
      if (!fs.existsSync(filePath)) continue
      const fileStat = fs.statSync(filePath)
      const cacheVersion = `${Math.trunc(fileStat.mtimeMs)}-${fileStat.size}`
      const animationNames = glbAnimationNames(filePath)
      const explicitOpenable = Boolean(asset.openable || asset.animation || asset.opening || asset.animation_frame_open)
      models.push({
        key: `${packName}/${asset.name}`,
        label: friendlyName(asset),
        category: packName,
        glbUrl: `builtin-models/${packName}/glb/${fileName}?v=${cacheVersion}`,
        geometry: dimensions(asset, packName, manifest, animationNames),
        states: builtinOpenableStates(animationNames, explicitOpenable),
      })
    }
  }
  return models
}

export async function syncBuiltinModels() {
  const models = readBuiltinModels()
  for (const model of models) {
    await db('entity_blueprints').insert({
      created_by: null,
      label: model.label,
      glb_url: model.glbUrl,
      geometry: JSON.stringify(model.geometry),
      states: JSON.stringify(model.states),
      interactions: JSON.stringify([]),
      deprecated: false,
      builtin_key: model.key,
      category: model.category,
    }).onConflict('builtin_key').merge({
      label: model.label,
      glb_url: model.glbUrl,
      geometry: JSON.stringify(model.geometry),
      states: JSON.stringify(model.states),
      category: model.category,
      deprecated: false,
      updated_at: db.fn.now(),
    })
  }
  const currentKeys = models.map(model => model.key)
  if (currentKeys.length > 0) {
    await db('entity_blueprints')
      .whereNotNull('builtin_key')
      .whereNotIn('builtin_key', currentKeys)
      .update({ deprecated: true, updated_at: db.fn.now() })
  }
  console.log(`Catalogue 3D intégré : ${models.length} modèles synchronisés`)
  return models
}
