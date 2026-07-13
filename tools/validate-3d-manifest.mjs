import fs from 'node:fs'
import path from 'node:path'

const manifestArg = process.argv[2]
if (!manifestArg) {
  console.error('Usage: node tools/validate-3d-manifest.mjs output/<pack>/manifest.json')
  process.exit(2)
}

const manifestPath = path.resolve(process.cwd(), manifestArg)
const packDir = path.dirname(manifestPath)
const errors = []
const warnings = []

function error(scope, message) {
  errors.push(`${scope}: ${message}`)
}

function warn(scope, message) {
  warnings.push(`${scope}: ${message}`)
}

function positiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0
}

function inspectGlb(glbPath, scope) {
  try {
    const buffer = fs.readFileSync(glbPath)
    if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67) {
      error(scope, 'le fichier n’est pas un GLB valide')
      return null
    }
    if (buffer.readUInt32LE(4) !== 2) error(scope, 'seul le format glTF/GLB 2 est supporté')
    const jsonLength = buffer.readUInt32LE(12)
    const jsonType = buffer.readUInt32LE(16)
    if (jsonType !== 0x4e4f534a || 20 + jsonLength > buffer.length) {
      error(scope, 'chunk JSON GLB invalide')
      return null
    }
    const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/g, '').trim())
    const externalUris = [
      ...(gltf.buffers || []).map(item => item?.uri),
      ...(gltf.images || []).map(item => item?.uri),
    ].filter(uri => typeof uri === 'string' && !uri.startsWith('data:'))
    if (externalUris.length > 0) {
      warn(scope, `ressources externes non embarquées : ${externalUris.join(', ')}`)
    }
    if ((gltf.cameras || []).length > 0) warn(scope, 'le GLB contient une caméra inutile')
    if (gltf.extensions?.KHR_lights_punctual?.lights?.length > 0) warn(scope, 'le GLB contient des lumières inutiles')
    const animationNames = (gltf.animations || []).map((animation, index) => animation?.name || `animation_${index}`)
    const unnamedAnimations = animationNames.filter(name => /^animation_\d+$/.test(name))
    if (unnamedAnimations.length > 0) warn(scope, `${unnamedAnimations.length} animation(s) sans nom stable`)
    return {
      materialNames: new Set((gltf.materials || []).map(material => String(material?.name || '').trim()).filter(Boolean)),
      animationNames: new Set(animationNames),
    }
  } catch (err) {
    error(scope, `lecture GLB impossible : ${err.message}`)
    return null
  }
}

function validateSlot(slot, scope, seenCodes, glbInfo) {
  if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
    error(scope, 'le slot doit être un objet')
    return
  }
  const code = String(slot.code || '').trim()
  if (!/^SLOT_\d{2}$/.test(code)) error(scope, 'code attendu au format SLOT_01')
  if (seenCodes.has(code)) error(scope, `code dupliqué ${code}`)
  if (code) seenCodes.add(code)
  if (!String(slot.id || '').trim()) error(scope, 'id manquant')
  if (!String(slot.label || '').trim()) error(scope, 'label manquant')
  if (!/^#[0-9a-f]{6}$/i.test(String(slot.default_hex || ''))) {
    error(scope, 'default_hex attendu au format #RRGGBB')
  }
  if (!Array.isArray(slot.material_names) || slot.material_names.length === 0) {
    error(scope, 'material_names doit contenir au moins un nom de matériau GLB')
  } else {
    const names = new Set()
    for (const materialName of slot.material_names) {
      const name = String(materialName || '').trim()
      if (!name) error(scope, 'material_names contient un nom vide')
      if (name && !name.includes(`__${code}__`)) {
        warn(scope, `${name} ne contient pas __${code}__ ; la correspondance dépendra du nom exact`)
      }
      if (names.has(name)) warn(scope, `nom de matériau dupliqué ${name}`)
      if (name && glbInfo && !glbInfo.materialNames.has(name)) {
        error(scope, `matériau absent du GLB : ${name}`)
      }
      names.add(name)
    }
  }
}

function validateAsset(asset, index, seenNames, manifest) {
  const scope = `assets[${index}]${asset?.name ? ` (${asset.name})` : ''}`
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    error(scope, 'l’asset doit être un objet')
    return
  }

  const name = String(asset.name || '').trim()
  if (!name) error(scope, 'name manquant')
  else {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) error(scope, 'name doit être un identifiant stable en minuscules sans espace')
    if (seenNames.has(name)) error(scope, `name dupliqué ${name}`)
    seenNames.add(name)
  }
  if (!String(asset.label || '').trim()) warn(scope, 'label manquant ; le serveur fabriquera un libellé depuis name')

  const fileName = String(asset.catalog_file || (name ? `${name}.glb` : '')).trim()
  if (!fileName.toLowerCase().endsWith('.glb')) error(scope, 'catalog_file doit désigner un fichier .glb')
  const glbPath = path.join(packDir, 'glb', fileName)
  if (fileName && !fs.existsSync(glbPath)) error(scope, `fichier absent : ${path.relative(process.cwd(), glbPath)}`)
  const glbInfo = fileName && fs.existsSync(glbPath) ? inspectGlb(glbPath, scope) : null

  const isDoor = positiveNumber(asset.door_panel_width_m) || positiveNumber(asset.door_panel_height_m)
  if (!positiveNumber(asset.footprint_width_m)) error(scope, 'footprint_width_m doit être > 0')
  if (!isDoor && !positiveNumber(asset.footprint_depth_m)) error(scope, 'footprint_depth_m doit être > 0')
  if (!isDoor && !positiveNumber(asset.height_m)) error(scope, 'height_m doit être > 0')
  if (isDoor) {
    if (!positiveNumber(asset.door_panel_width_m)) error(scope, 'door_panel_width_m doit être > 0')
    if (!positiveNumber(asset.door_panel_height_m)) error(scope, 'door_panel_height_m doit être > 0')
    if (!positiveNumber(asset.wall_cut_width_m)) error(scope, 'wall_cut_width_m doit être > 0')
    if (positiveNumber(asset.wall_cut_width_m) && positiveNumber(asset.footprint_width_m)
      && Number(asset.wall_cut_width_m) > Number(asset.footprint_width_m)) {
      warn(scope, 'wall_cut_width_m dépasse footprint_width_m')
    }
  }

  const hasAssetPlacementMode = asset.placement_mode !== undefined
  const placementMode = hasAssetPlacementMode ? asset.placement_mode : manifest.placement_mode_default
  const origin = asset.origin ?? (!hasAssetPlacementMode ? manifest.origin_default : undefined)
  const wallMount = asset.wall_mount ?? manifest.wall_mount_default
  if (placementMode === undefined) warn(scope, 'placement_mode absent (mettre free ou wall dans les nouveaux packs)')
  else if (!['free', 'wall', 'connector'].includes(placementMode)) error(scope, 'placement_mode doit valoir free, wall ou connector')

  if (placementMode === 'free' && origin !== 'floor-center') error(scope, 'un objet free doit utiliser origin=floor-center')
  if (placementMode === 'wall' && origin !== 'wall-back-center') error(scope, 'un objet wall doit utiliser origin=wall-back-center')
  if (placementMode === 'wall') {
    if (!wallMount || typeof wallMount !== 'object') error(scope, 'wall_mount manquant pour un objet wall')
    else if (!Number.isFinite(Number(wallMount.default_bottom_height))) {
      error(scope, 'wall_mount.default_bottom_height doit être un nombre')
    }
  }
  if (isDoor && placementMode && placementMode !== 'connector') warn(scope, 'une porte structurelle devrait utiliser placement_mode=connector')

  if (Array.isArray(asset.color_slots) && asset.color_slots.length > 0 && !asset.editor_color_slots) {
    warn(scope, 'color_slots est converti automatiquement pour compatibilité ; préférer editor_color_slots dans les nouveaux packs')
  }
  if (asset.editor_color_slots !== undefined && !Array.isArray(asset.editor_color_slots)) {
    error(scope, 'editor_color_slots doit être un tableau')
  } else {
    const seenCodes = new Set()
    for (const [slotIndex, slot] of (asset.editor_color_slots || []).entries()) {
      validateSlot(slot, `${scope}.editor_color_slots[${slotIndex}]`, seenCodes, glbInfo)
    }
  }
  if (Array.isArray(asset.animations) && glbInfo) {
    for (const animation of asset.animations) {
      const clip = typeof animation === 'string' ? animation : animation?.clip
      if (clip && !glbInfo.animationNames.has(clip)) error(scope, `clip d’animation absent du GLB : ${clip}`)
    }
  }
  if (asset.glb) warn(scope, 'le champ glb absolu est ignoré ; catalog_file suffit')
}

let manifest
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
} catch (err) {
  console.error(`ERREUR: impossible de lire ${manifestPath}: ${err.message}`)
  process.exit(1)
}

if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
  error('manifest', 'la racine doit être un objet JSON')
} else if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
  error('manifest', 'assets doit être un tableau non vide')
} else {
  const seenNames = new Set()
  manifest.assets.forEach((asset, index) => validateAsset(asset, index, seenNames, manifest))
}

console.log(`Manifest: ${path.relative(process.cwd(), manifestPath)}`)
console.log(`Assets: ${Array.isArray(manifest?.assets) ? manifest.assets.length : 0}`)
for (const message of warnings) console.warn(`AVERTISSEMENT: ${message}`)
for (const message of errors) console.error(`ERREUR: ${message}`)
console.log(`Résultat: ${errors.length} erreur(s), ${warnings.length} avertissement(s)`)
process.exit(errors.length > 0 ? 1 : 0)
