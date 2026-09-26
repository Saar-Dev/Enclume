// shared/world/surfaceFieldTypes.js
// Types stricts des champs d'un document de carte reçu d'un tiers (fichier importé) — segment S0 du chantier « éditeur de
// carte » : docs/PLANS/PLAN_EXPORT_CARTE.md §12 (L1a-3).
//
// Pourquoi : le validateur de production accepte pour un « nombre » tout ce que `Number()` rend fini (null, "", true, "0x10"),
// et ne type pas la plupart des champs (épaisseurs, heightLevels, y, level…). Un fichier hostile peut donc faire stocker des chaînes
// là où le moteur et le rendu attendent des nombres. Ce module NE MODIFIE PAS le validateur (risque de rejeter une carte
// historique) : il ajoute un contrôle de type, pour l'import seulement, à appeler après les gardes de structure et avant
// `validateSurfaceData` (ordre : scanJsonStructure → checkSurfaceLimits → checkStrictTypes → validateSurfaceData).
//
// Règles : seuls les champs PRÉSENTS et non nuls sont contrôlés (un champ absent ou null reste toléré, comme le fait le validateur pour
// les champs facultatifs) ; les clés inconnues ne sont pas concernées ; les champs OBLIGATOIRES (`required`) doivent être de vrais nombres.
// DUPLICATION ASSUMÉE ET TEMPORAIRE de la connaissance du validateur (schéma unique à terme, comme Foundry DataModel ou zod) :
// un test exige que chaque champ numérique contrôlé par le validateur figure ici.

import { MAP_LIMITS } from './mapLimits.js'
import { createCollector, isPlainObject } from './guardErrors.js'

const N = 'number'
const S = 'string'
const B = 'boolean'
const O = 'object'
const A = 'array'
const R = 'reference' // nombre, chaîne ou null (référence de texture)

export const STRICT_TYPE_CODES = Object.freeze(['wrong_type', 'not_object'])

const MATERIAL = Object.freeze({
  material: S, paint: S, pattern: S, seed: S, wear: N, dirt: N, relief: N, realRelief: B,
})

const ROOM = Object.freeze({
  minX: N, maxX: N, minZ: N, maxZ: N, y: N, level: N, height: N, heightLevels: N,
  floorThickness: N, ceilingThickness: N, wallThickness: N, movementMultiplier: N, movementCostMultiplier: N,
  label: S, type: S, shape: S, theme: S, barrierType: S, worldId: S,
  blocksSight: B, blocksWater: B, blocksMovement: B, wallEnabled: B, floorEnabled: B, ceilingEnabled: B,
  floorTex: R, ceilingTex: R, wallInteriorTex: R,
  floorMaterial: O, ceilingMaterial: O, wallInteriorMaterial: O,
  cells: A, boundaryArcs: A, wallElevationProfiles: A, wallAppearanceProfiles: A,
  openWallEdgeKeys: A, geometryClipRoomIds: A, verticalProfile: O,
})
const ROOM_REQUIRED = Object.freeze(['minX', 'maxX', 'minZ', 'maxZ'])

const ARC = Object.freeze({ id: S, edgeKeys: A, start: O, end: O, angleDegrees: N, side: N })
const POINT = Object.freeze({ x: N, z: N })
const ELEVATION_ENTRY = Object.freeze({ id: S, edgeKeys: A, profile: O })
const ELEVATION_PROFILE = Object.freeze({ type: S, depth: N, direction: N })
const APPEARANCE_ENTRY = Object.freeze({ id: S, edgeKeys: A, interiorTex: R, interiorMaterial: O })
const SLICE = Object.freeze({ offset: N, footprint: A, wallPaths: A })
const WALL_PATH = Object.freeze({
  axis: S, x0: N, z0: N, x1: N, z1: N, centerX: N, centerZ: N, radius: N, startAngle: N, sweep: N,
  id: S, sourceEdgeKeys: A, curveArcId: S, elevationProfile: O,
})

const CONNECTOR = Object.freeze({
  type: S, axis: S, state: S, id: S, worldId: S, roomId: S, roomIds: A,
  x0: N, x1: N, z0: N, z1: N, y: N, depth: N, level: N, width: N, height: N, thickness: N, alongCenter: N,
  anchorX: N, anchorZ: N, tangentX: N, tangentZ: N, normalX: N, normalZ: N, rotationY: N, curveOffset: N, curveId: S,
  x: N, z: N, fromLevel: N, toLevel: N, stops: A, movementMultiplier: N, lockDifficultyDc: N,
  blocksSight: B, blocksWater: B, blocksMovement: B, barrierType: S,
  modelLabel: S, modelCategory: S, modelGlbUrl: S, modelBuiltinKey: S, modelBlueprintId: S,
  modelGeometry: O, modelMaterialOverrides: O,
})
const DOOR_REQUIRED = Object.freeze(['x0', 'x1', 'z0', 'z1', 'y'])
const DOOR_SEGMENT_REQUIRED = Object.freeze(['anchorX', 'anchorZ', 'tangentX', 'tangentZ', 'normalX', 'normalZ', 'rotationY', 'curveOffset'])
const ELEVATOR_REQUIRED = Object.freeze(['x', 'z', 'fromLevel', 'toLevel'])

// Collections historiques : coordonnées seulement, et seulement si présentes (elles peuvent aussi venir de la clé de l'élément).
const FLOOR = Object.freeze({ x: N, z: N, y: N, topY: N, thickness: N, worldId: S })
const CEILING = Object.freeze({ x: N, z: N, baseY: N, y: N, thickness: N, worldId: S })
const WALL = Object.freeze({ axis: S, x0: N, x1: N, z0: N, z1: N, y: N, height: N, thickness: N, worldId: S })
const WALL_REQUIRED = Object.freeze(['x0', 'x1', 'z0', 'z1'])
const STAIR = Object.freeze({ axis: S, minX: N, maxX: N, minZ: N, maxZ: N, y: N, topY: N, worldId: S })
const STAIR_REQUIRED = Object.freeze(['minX', 'maxX', 'minZ', 'maxZ', 'y', 'topY'])

const TOP_LEVEL = Object.freeze({ version: N, fine: N, storyHeight: N, metersPerCell: N })

// Table exposée (test de dérive) : toutes les tables de champs, à plat.
export const SURFACE_FIELD_TABLES = Object.freeze({
  TOP_LEVEL, ROOM, MATERIAL, ARC, POINT, ELEVATION_ENTRY, ELEVATION_PROFILE, APPEARANCE_ENTRY, SLICE, WALL_PATH,
  CONNECTOR, FLOOR, CEILING, WALL, STAIR,
})

function matches(type, value) {
  switch (type) {
    case N: return typeof value === 'number' && Number.isFinite(value)
    case S: return typeof value === 'string'
    case B: return typeof value === 'boolean'
    case O: return isPlainObject(value)
    case A: return Array.isArray(value)
    case R: return (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'string'
    default: return true
  }
}

function describe(value) {
  if (value === undefined) return 'missing'
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number' && !Number.isFinite(value)) return 'non_finite'
  return typeof value
}

// Vérifie les champs présents et non nuls d'un élément contre une table, puis les champs obligatoires.
function checkItem(item, table, required, path, collector) {
  const reported = new Set()
  for (const [field, type] of Object.entries(table)) {
    if (!Object.hasOwn(item, field)) continue
    const value = item[field]
    if (value === null || value === undefined) continue
    if (!matches(type, value)) {
      reported.add(field)
      collector.add('wrong_type', { path: `${path}.${field}`, expected: type, actual: describe(value) })
    }
  }
  for (const field of required) {
    // Un champ obligatoire de mauvais type a déjà été signalé ci-dessus (pas de double signalement).
    if (!reported.has(field) && !matches(N, item[field])) {
      collector.add('wrong_type', { path: `${path}.${field}`, expected: N, actual: describe(item[field]) })
    }
  }
}

function checkMaterial(item, field, path, collector) {
  const material = item[field]
  if (isPlainObject(material)) checkItem(material, MATERIAL, [], `${path}.${field}`, collector)
}

function checkRoom(id, room, collector) {
  const path = `$.rooms.${id}`
  checkItem(room, ROOM, ROOM_REQUIRED, path, collector)
  for (const field of ['floorMaterial', 'ceilingMaterial', 'wallInteriorMaterial']) checkMaterial(room, field, path, collector)

  if (Array.isArray(room.boundaryArcs)) {
    room.boundaryArcs.forEach((arc, index) => {
      if (collector.isFull || !isPlainObject(arc)) return
      const arcPath = `${path}.boundaryArcs[${index}]`
      checkItem(arc, ARC, [], arcPath, collector)
      for (const end of ['start', 'end']) {
        if (isPlainObject(arc[end])) checkItem(arc[end], POINT, ['x', 'z'], `${arcPath}.${end}`, collector)
      }
    })
  }
  if (Array.isArray(room.wallElevationProfiles)) {
    room.wallElevationProfiles.forEach((entry, index) => {
      if (collector.isFull || !isPlainObject(entry)) return
      const entryPath = `${path}.wallElevationProfiles[${index}]`
      checkItem(entry, ELEVATION_ENTRY, [], entryPath, collector)
      if (isPlainObject(entry.profile)) checkItem(entry.profile, ELEVATION_PROFILE, [], `${entryPath}.profile`, collector)
    })
  }
  if (Array.isArray(room.wallAppearanceProfiles)) {
    room.wallAppearanceProfiles.forEach((entry, index) => {
      if (collector.isFull || !isPlainObject(entry)) return
      const entryPath = `${path}.wallAppearanceProfiles[${index}]`
      checkItem(entry, APPEARANCE_ENTRY, [], entryPath, collector)
      checkMaterial(entry, 'interiorMaterial', entryPath, collector)
    })
  }
  const slices = room.verticalProfile?.slices
  if (Array.isArray(slices)) {
    slices.forEach((slice, sliceIndex) => {
      if (collector.isFull || !isPlainObject(slice)) return
      const slicePath = `${path}.verticalProfile.slices[${sliceIndex}]`
      checkItem(slice, SLICE, [], slicePath, collector)
      if (Array.isArray(slice.wallPaths)) {
        slice.wallPaths.forEach((wall, wallIndex) => {
          if (collector.isFull || !isPlainObject(wall)) return
          const required = ['x0', 'z0', 'x1', 'z1']
          if (wall.axis === 'arc') required.push('centerX', 'centerZ', 'radius', 'startAngle', 'sweep')
          const wallPath = `${slicePath}.wallPaths[${wallIndex}]`
          checkItem(wall, WALL_PATH, required, wallPath, collector)
          if (isPlainObject(wall.elevationProfile)) {
            checkItem(wall.elevationProfile, ELEVATION_PROFILE, [], `${wallPath}.elevationProfile`, collector)
          }
        })
      }
    })
  }
}

function checkConnector(id, connector, collector) {
  const path = `$.connectors.${id}`
  const required = []
  if (connector.type === 'door') {
    required.push(...DOOR_REQUIRED)
    if (connector.axis === 'segment') required.push(...DOOR_SEGMENT_REQUIRED)
  } else if (connector.type === 'elevator') {
    required.push(...ELEVATOR_REQUIRED)
  }
  checkItem(connector, CONNECTOR, required, path, collector)
}

const LEGACY = Object.freeze({
  floors: [FLOOR, []],
  ceilings: [CEILING, []],
  walls: [WALL, WALL_REQUIRED],
  stairs: [STAIR, STAIR_REQUIRED],
})

export function checkStrictTypes(surface, limits = MAP_LIMITS) {
  const collector = createCollector(limits.maxErrors)
  if (!isPlainObject(surface)) {
    collector.add('not_object', { path: '$' })
    return collector.result()
  }

  checkItem(surface, TOP_LEVEL, [], '$', collector)

  // Ces parcours supposent que la garde de structure (limites de nombre d'éléments) est passée : voir l'ordre d'utilisation.
  const each = (collection, visit) => {
    const record = surface[collection]
    if (!isPlainObject(record)) return
    for (const [id, item] of Object.entries(record)) {
      if (collector.isFull) {
        collector.markTruncated()
        return
      }
      if (isPlainObject(item)) visit(id, item)
    }
  }
  each('rooms', (id, room) => checkRoom(id, room, collector))
  each('connectors', (id, connector) => checkConnector(id, connector, collector))
  for (const [collection, [table, required]] of Object.entries(LEGACY)) {
    each(collection, (id, item) => checkItem(item, table, required, `$.${collection}.${id}`, collector))
  }

  return collector.result()
}
