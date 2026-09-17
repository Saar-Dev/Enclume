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

// validateStates / validateInteractions — entity_blueprints.states/interactions (jsonb, sans
// contrainte de forme en base) alimentées par ce manifest ET par l'Atelier (entity-blueprints.js,
// même absence de validation serveur). Un défaut de forme ici traverse tout le pipeline sans être
// détecté avant d'atteindre le client — vécu : Session (Dev) 2026-09-16, required_state_ids
// manquant sur une interaction de déplacement a fait planter SessionPage.jsx à chaque clic sur
// l'entité (deux sites de lecture non protégés, cf. client/src/lib/entityInteractions.js).
function validateStates(asset, scope) {
  const stateIds = new Set()
  if (asset.states === undefined) return stateIds
  if (!Array.isArray(asset.states)) {
    error(scope, 'states doit être un tableau')
    return stateIds
  }
  asset.states.forEach((state, index) => {
    const stateScope = `${scope}.states[${index}]`
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      error(stateScope, 'un état doit être un objet')
      return
    }
    if (!Number.isInteger(state.id) || state.id < 0) error(stateScope, 'id doit être un entier >= 0')
    else if (stateIds.has(state.id)) error(stateScope, `id dupliqué ${state.id}`)
    else stateIds.add(state.id)
    if (!String(state.name || '').trim()) warn(stateScope, 'name manquant')
  })
  return stateIds
}

function validateInteractions(asset, scope, stateIds) {
  if (asset.interactions === undefined) return
  if (!Array.isArray(asset.interactions)) {
    error(scope, 'interactions doit être un tableau')
    return
  }
  const seenIds = new Set()
  asset.interactions.forEach((interaction, index) => {
    const interactionScope = `${scope}.interactions[${index}]`
    if (!interaction || typeof interaction !== 'object' || Array.isArray(interaction)) {
      error(interactionScope, 'une interaction doit être un objet')
      return
    }
    const id = String(interaction.id || '').trim()
    if (!id) error(interactionScope, 'id manquant')
    else if (seenIds.has(id)) error(interactionScope, `id dupliqué ${id}`)
    else seenIds.add(id)

    // action_label lu sans garde par RadialMenu.jsx (truncate() plante sur undefined).
    if (!String(interaction.action_label || '').trim()) error(interactionScope, 'action_label manquant')

    // required_state_ids lu sans garde par SessionPage.jsx (deux sites) via
    // getAvailableInteractions — absent/mal formé fait disparaître l'interaction (avec la garde
    // actuelle) ou plantait la session (avant le durcissement de cette même session).
    if (!Array.isArray(interaction.required_state_ids)) {
      error(interactionScope, 'required_state_ids doit être un tableau (même vide) — sinon l’interaction ne s’affichera jamais côté client')
    } else {
      for (const stateId of interaction.required_state_ids) {
        if (!stateIds.has(stateId)) error(interactionScope, `required_state_ids référence un état inexistant : ${stateId}`)
      }
    }

    const hasMoveType = interaction.move_type !== undefined && interaction.move_type !== null
    if (hasMoveType) {
      if (interaction.move_type !== 'displacement') error(interactionScope, `move_type inconnu : ${interaction.move_type} (seule la valeur "displacement" existe)`)
      if (interaction.target_state_id !== undefined && interaction.target_state_id !== null) {
        warn(interactionScope, 'target_state_id ignoré sur une interaction de déplacement (move_type)')
      }
    } else if (interaction.target_state_id !== undefined && interaction.target_state_id !== null) {
      if (!stateIds.has(interaction.target_state_id)) error(interactionScope, `target_state_id référence un état inexistant : ${interaction.target_state_id}`)
    }

    if (interaction.range !== undefined && !positiveNumber(interaction.range)) error(interactionScope, 'range doit être un nombre > 0')
    if (interaction.difficulty_dc !== undefined && !Number.isFinite(Number(interaction.difficulty_dc))) error(interactionScope, 'difficulty_dc doit être un nombre')
    if (interaction.dmax_override !== undefined && interaction.dmax_override !== null && !positiveNumber(interaction.dmax_override)) {
      error(interactionScope, 'dmax_override doit être un nombre > 0 ou null')
    }
  })
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

  const stateIds = validateStates(asset, scope)
  validateInteractions(asset, scope, stateIds)
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
