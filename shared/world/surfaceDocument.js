// shared/world/surfaceDocument.js
// Frontière de compatibilité entre surface_data v6 (empreintes et arcs de salles) et le document canonique du
// moteur de monde. Les clés legacy restent lisibles ; worldId devient l'identité physique stable.

import { createWorldDocument } from './worldContracts.js'
import { selectedRoomBoundaryChain } from './roomGeometry.js'

export const SURFACE_DATA_VERSION = 6
export const SURFACE_FINE_DEFAULT = 4
export const SURFACE_STORY_HEIGHT_DEFAULT = 2.5

export const SURFACE_COLLECTIONS = Object.freeze([
  'rooms',
  'floors',
  'walls',
  'ceilings',
  'stairs',
  'connectors',
])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]))
  }
  return value
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function positiveNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function hash32(value, salt) {
  let hash = (2166136261 ^ salt) >>> 0
  const text = String(value)
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 2246822507)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 3266489909)
  hash ^= hash >>> 16
  return hash >>> 0
}

export function deterministicWorldId(namespace, collection, legacyId) {
  const name = `${namespace ?? 'unscoped'}|${collection}|${legacyId}`
  const hex = [0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f]
    .map(salt => hash32(name, salt).toString(16).padStart(8, '0'))
    .join('')
    .split('')
  hex[12] = '5'
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4]
  const raw = hex.join('')
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
}

function validateFiniteFields(item, fields, path, errors) {
  for (const field of fields) {
    if (!Number.isFinite(Number(item[field]))) errors.push(`${path}.${field} doit être un nombre fini`)
  }
}

function validateMovementMultiplier(item, path, errors) {
  const value = item.movementMultiplier ?? item.movementCostMultiplier
  if (value != null && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
    errors.push(`${path}.movementMultiplier doit être strictement positif`)
  }
}

function validateFeature(collection, id, item, errors) {
  const path = `$.${collection}.${id}`
  if (!isPlainObject(item)) {
    errors.push(`${path} doit être un objet`)
    return
  }
  if (item.worldId != null && !UUID_RE.test(item.worldId)) {
    errors.push(`${path}.worldId doit être un UUID`)
  }
  validateMovementMultiplier(item, path, errors)

  if (collection === 'rooms') {
    validateFiniteFields(item, ['minX', 'maxX', 'minZ', 'maxZ'], path, errors)
    if (item.cells != null) {
      if (!Array.isArray(item.cells) || item.cells.length === 0) {
        errors.push(`${path}.cells doit être un tableau non vide`)
      } else {
        const seen = new Set()
        for (const [index, value] of item.cells.entries()) {
          const [rawX, rawZ] = typeof value === 'string'
            ? value.split(':')
            : [value?.x, value?.z]
          const x = Number(rawX)
          const z = Number(rawZ)
          if (!Number.isInteger(x) || !Number.isInteger(z)) {
            errors.push(`${path}.cells.${index} doit décrire une case entière x:z`)
            continue
          }
          const key = `${x}:${z}`
          if (seen.has(key)) errors.push(`${path}.cells contient la case ${key} plusieurs fois`)
          seen.add(key)
          if (x < Number(item.minX) || x > Number(item.maxX) || z < Number(item.minZ) || z > Number(item.maxZ)) {
            errors.push(`${path}.cells.${index} sort des bornes de la salle`)
          }
        }
      }
    }
    if (item.boundaryArcs != null) {
      if (!Array.isArray(item.boundaryArcs)) {
        errors.push(`${path}.boundaryArcs doit être un tableau`)
      } else {
        const arcIds = new Set()
        for (const [index, arc] of item.boundaryArcs.entries()) {
          const arcPath = `${path}.boundaryArcs.${index}`
          if (!isPlainObject(arc)) {
            errors.push(`${arcPath} doit être un objet`)
            continue
          }
          if (typeof arc.id !== 'string' || !arc.id.trim()) errors.push(`${arcPath}.id est obligatoire`)
          else if (arcIds.has(arc.id)) errors.push(`${path}.boundaryArcs contient deux fois ${arc.id}`)
          else arcIds.add(arc.id)
          const edgeKeysValid = Array.isArray(arc.edgeKeys)
            && arc.edgeKeys.length >= 2
            && arc.edgeKeys.every(key => typeof key === 'string')
          if (!edgeKeysValid) {
            errors.push(`${arcPath}.edgeKeys doit contenir au moins deux murs`)
          } else if (new Set(arc.edgeKeys).size !== arc.edgeKeys.length) {
            errors.push(`${arcPath}.edgeKeys contient des murs en double`)
          } else {
            const chain = selectedRoomBoundaryChain(item, arc.edgeKeys)
            if (chain.error) {
              errors.push(`${arcPath}.edgeKeys ne forme pas une chaîne valide : ${chain.error}`)
            } else {
              const closePoint = (left, right) => (
                Math.abs(Number(left?.x) - Number(right?.x)) <= 1e-6
                && Math.abs(Number(left?.z) - Number(right?.z)) <= 1e-6
              )
              const endpointsMatch = (
                closePoint(arc.start, chain.start) && closePoint(arc.end, chain.end)
              ) || (
                closePoint(arc.start, chain.end) && closePoint(arc.end, chain.start)
              )
              if (!endpointsMatch) errors.push(`${arcPath} ne rejoint pas les extrémités de sa chaîne`)
            }
          }
          validateFiniteFields(arc.start || {}, ['x', 'z'], `${arcPath}.start`, errors)
          validateFiniteFields(arc.end || {}, ['x', 'z'], `${arcPath}.end`, errors)
          const angle = Number(arc.angleDegrees)
          if (!Number.isFinite(angle) || angle < 5 || angle > 175) {
            errors.push(`${arcPath}.angleDegrees doit être compris entre 5 et 175`)
          }
          if (![1, -1].includes(Number(arc.side))) errors.push(`${arcPath}.side doit valoir 1 ou -1`)
        }
      }
    }
  } else if (collection === 'floors') {
    const [keyX, keyZ, keyY = 0] = String(id).split(':')
    const x = item.x ?? keyX
    const z = item.z ?? keyZ
    const y = item.y ?? keyY
    if (![x, z, y].every(value => Number.isFinite(Number(value)))) {
      errors.push(`${path} doit fournir des coordonnées x/z/y valides`)
    }
  } else if (collection === 'ceilings') {
    const [keyX, keyZ, keyBaseY = 0, keyY = SURFACE_STORY_HEIGHT_DEFAULT] = String(id).split(':')
    const values = [item.x ?? keyX, item.z ?? keyZ, item.baseY ?? keyBaseY, item.y ?? keyY]
    if (!values.every(value => Number.isFinite(Number(value)))) {
      errors.push(`${path} doit fournir des coordonnées x/z/baseY/y valides`)
    }
  } else if (collection === 'walls') {
    if (!['x', 'z', 'segment'].includes(item.axis)) errors.push(`${path}.axis doit valoir x, z ou segment`)
    validateFiniteFields(item, ['x0', 'x1', 'z0', 'z1'], path, errors)
  } else if (collection === 'stairs') {
    if (!['x', 'z'].includes(item.axis)) errors.push(`${path}.axis doit valoir x ou z`)
    validateFiniteFields(item, ['minX', 'maxX', 'minZ', 'maxZ', 'y', 'topY'], path, errors)
  } else if (collection === 'connectors') {
    if (typeof item.type !== 'string' || !item.type.trim()) errors.push(`${path}.type est obligatoire`)
    if (item.type === 'door') {
      if (!['x', 'z'].includes(item.axis)) errors.push(`${path}.axis doit valoir x ou z`)
      validateFiniteFields(item, ['x0', 'x1', 'z0', 'z1', 'y'], path, errors)
    } else if (item.type === 'elevator') {
      validateFiniteFields(item, ['x', 'z', 'fromLevel', 'toLevel'], path, errors)
    }
  }
}

function validationResult(errors) {
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) })
}

export class SurfaceDocumentError extends Error {
  constructor(errors) {
    super(`surface_data invalide : ${errors.join(' ; ')}`)
    this.name = 'SurfaceDocumentError'
    this.errors = Object.freeze([...errors])
  }
}

export function validateSurfaceData(input) {
  const errors = []
  if (!isPlainObject(input)) return validationResult(['$ doit être un objet'])

  const version = input.version ?? SURFACE_DATA_VERSION
  if (!Number.isInteger(Number(version)) || Number(version) < 1 || Number(version) > SURFACE_DATA_VERSION) {
    errors.push(`$.version doit être comprise entre 1 et ${SURFACE_DATA_VERSION}`)
  }
  if (input.fine != null && (!Number.isFinite(Number(input.fine)) || Number(input.fine) <= 0)) {
    errors.push('$.fine doit être strictement positif')
  }
  if (input.storyHeight != null && (!Number.isFinite(Number(input.storyHeight)) || Number(input.storyHeight) <= 0)) {
    errors.push('$.storyHeight doit être strictement positif')
  }

  for (const collection of SURFACE_COLLECTIONS) {
    const record = input[collection] ?? {}
    if (!isPlainObject(record)) {
      errors.push(`$.${collection} doit être un objet`)
      continue
    }
    for (const [id, item] of Object.entries(record)) validateFeature(collection, id, item, errors)
  }
  return validationResult(errors)
}

export function assertSurfaceData(input) {
  const validation = validateSurfaceData(input)
  if (!validation.valid) throw new SurfaceDocumentError(validation.errors)
  return input
}

export function normalizeSurfaceDataDocument(input) {
  assertSurfaceData(input)
  const normalized = {
    ...cloneValue(input),
    version: SURFACE_DATA_VERSION,
    fine: positiveNumber(input.fine, SURFACE_FINE_DEFAULT),
    storyHeight: positiveNumber(input.storyHeight, SURFACE_STORY_HEIGHT_DEFAULT),
  }
  for (const collection of SURFACE_COLLECTIONS) {
    normalized[collection] = cloneValue(input[collection] ?? {})
  }
  return normalized
}

function withWorldIds(surfaceData, battlemapId, reseed) {
  const next = { ...surfaceData }
  let changed = false
  for (const collection of SURFACE_COLLECTIONS) {
    next[collection] = Object.fromEntries(Object.entries(surfaceData[collection]).map(([legacyId, item]) => {
      const existing = item.worldId
      const worldId = !reseed && UUID_RE.test(existing)
        ? existing
        : deterministicWorldId(battlemapId, collection, legacyId)
      if (existing !== worldId) changed = true
      return [legacyId, { ...item, worldId }]
    }))
  }
  return { surfaceData: next, changed }
}

function canonicalFeature(item, legacyId, sourceCollection, patch = {}) {
  return {
    ...cloneValue(item),
    ...patch,
    id: item.worldId,
    legacyId,
    sourceCollection,
  }
}

function toWorldDocument(surfaceData, battlemapId) {
  const features = {
    rooms: {},
    floors: {},
    walls: {},
    ceilings: {},
    connectors: {},
    regions: {},
  }
  for (const collection of ['rooms', 'floors', 'walls', 'ceilings']) {
    for (const [legacyId, item] of Object.entries(surfaceData[collection])) {
      features[collection][item.worldId] = canonicalFeature(item, legacyId, collection)
    }
  }
  for (const [legacyId, item] of Object.entries(surfaceData.connectors)) {
    features.connectors[item.worldId] = canonicalFeature(item, legacyId, 'connectors')
  }
  for (const [legacyId, item] of Object.entries(surfaceData.stairs)) {
    features.connectors[item.worldId] = canonicalFeature(item, legacyId, 'stairs', { type: 'stairs' })
  }

  return createWorldDocument({
    battlemapId,
    metrics: {
      metersPerCell: positiveNumber(surfaceData.metersPerCell, 1.5),
      worldUnitsPerCell: 1,
      storyHeightWorld: surfaceData.storyHeight,
    },
    features,
  })
}

export function prepareSurfaceData(input, { battlemapId = null, reseedWorldIds = false } = {}) {
  const normalized = normalizeSurfaceDataDocument(input)
  const identified = withWorldIds(normalized, battlemapId, reseedWorldIds)
  assertSurfaceData(identified.surfaceData)
  const worldDocument = toWorldDocument(identified.surfaceData, battlemapId)
  return deepFreeze({
    surfaceData: identified.surfaceData,
    worldDocument,
    changed: identified.changed || Number(input.version ?? SURFACE_DATA_VERSION) !== SURFACE_DATA_VERSION,
  })
}

export function collectSurfaceTextureIds(input) {
  const surface = normalizeSurfaceDataDocument(input)
  const ids = new Set()
  const add = value => {
    if (value != null && value !== '') ids.add(value)
  }

  for (const floor of Object.values(surface.floors)) {
    add(floor.tex); add(floor.topTex); add(floor.bottomTex)
  }
  for (const wall of Object.values(surface.walls)) {
    add(wall.frontTex); add(wall.backTex); add(wall.topTex)
  }
  for (const ceiling of Object.values(surface.ceilings)) {
    add(ceiling.tex); add(ceiling.topTex); add(ceiling.bottomTex)
  }
  for (const stair of Object.values(surface.stairs)) add(stair.tex)
  for (const room of Object.values(surface.rooms)) {
    add(room.floorTopTex); add(room.floorBottomTex)
    add(room.ceilingTopTex); add(room.ceilingBottomTex)
    add(room.wallInteriorTex); add(room.wallExteriorTex)
    add(room.wallFrontTex); add(room.wallBackTex); add(room.wallTopTex)
  }
  return Object.freeze([...ids])
}
