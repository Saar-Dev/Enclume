// shared/world/worldContracts.js
// Enveloppes versionnées et strictes du futur moteur. Le document édité, l'état runtime et le
// snapshot compilé sont volontairement trois contrats différents.

import { createWorldMetrics, DEFAULT_WORLD_METRICS } from './worldMetrics.js'

export const WORLD_DOCUMENT_SCHEMA = 'enclume.world-document'
export const WORLD_RUNTIME_SCHEMA = 'enclume.world-runtime'
export const WORLD_SNAPSHOT_SCHEMA = 'enclume.world-snapshot'

export const WORLD_DOCUMENT_SCHEMA_VERSION = 1
export const WORLD_RUNTIME_SCHEMA_VERSION = 1
export const WORLD_SNAPSHOT_SCHEMA_VERSION = 1

export const WORLD_DOCUMENT_COLLECTIONS = Object.freeze([
  'rooms',
  'floors',
  'walls',
  'ceilings',
  'connectors',
  'regions',
])

export const WORLD_SNAPSHOT_COLLECTIONS = Object.freeze([
  'supports',
  'barriers',
  'traversals',
  'colliders',
  'occluders',
  'compartments',
  'regions',
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

function validateEnvelope(value, schema, version, errors) {
  if (!isPlainObject(value)) {
    errors.push('$ doit être un objet')
    return false
  }
  if (value.schema !== schema) errors.push(`$.schema doit valoir ${schema}`)
  if (value.version !== version) errors.push(`$.version doit valoir ${version}`)
  if (value.battlemapId != null && (typeof value.battlemapId !== 'string' || !value.battlemapId.trim())) {
    errors.push('$.battlemapId doit être null ou une chaîne non vide')
  }
  return true
}

function validateMetrics(metrics, errors) {
  if (!isPlainObject(metrics)) {
    errors.push('$.metrics doit être un objet')
    return
  }
  try {
    createWorldMetrics(metrics)
  } catch (error) {
    errors.push(`$.metrics invalide : ${error.message}`)
  }
}

function validateUuidRecord(record, path, errors) {
  if (!isPlainObject(record)) {
    errors.push(`${path} doit être un objet indexé par UUID`)
    return
  }
  for (const [id, item] of Object.entries(record)) {
    if (!UUID_RE.test(id)) errors.push(`${path}.${id} utilise un identifiant non stable`)
    if (!isPlainObject(item)) {
      errors.push(`${path}.${id} doit être un objet`)
      continue
    }
    if (item.id !== id) errors.push(`${path}.${id}.id doit correspondre à sa clé`)
  }
}

function validateNamedArrays(container, collections, path, errors) {
  if (!isPlainObject(container)) {
    errors.push(`${path} doit être un objet`)
    return
  }
  for (const key of Object.keys(container)) {
    if (!collections.includes(key)) errors.push(`${path}.${key} est une collection inconnue`)
  }
  for (const name of collections) {
    const items = container[name]
    if (!Array.isArray(items)) {
      errors.push(`${path}.${name} doit être un tableau`)
      continue
    }
    const ids = new Set()
    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      if (!isPlainObject(item)) {
        errors.push(`${path}.${name}[${index}] doit être un objet`)
        continue
      }
      if (typeof item.id !== 'string' || !item.id.trim()) {
        errors.push(`${path}.${name}[${index}].id doit être une chaîne non vide`)
      } else if (ids.has(item.id)) {
        errors.push(`${path}.${name} contient deux fois l'id ${item.id}`)
      } else {
        ids.add(item.id)
      }
    }
  }
}

function assertKnownCollections(container, collections, path, contractName) {
  if (!isPlainObject(container)) {
    throw new WorldContractError(contractName, [`${path} doit être un objet`])
  }
  const errors = Object.keys(container)
    .filter(key => !collections.includes(key))
    .map(key => `${path}.${key} est une collection inconnue`)
  if (errors.length > 0) throw new WorldContractError(contractName, errors)
}

function result(errors) {
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) })
}

export class WorldContractError extends Error {
  constructor(contractName, errors) {
    super(`${contractName} invalide : ${errors.join(' ; ')}`)
    this.name = 'WorldContractError'
    this.contractName = contractName
    this.errors = Object.freeze([...errors])
  }
}

export function validateWorldDocument(value) {
  const errors = []
  if (!validateEnvelope(value, WORLD_DOCUMENT_SCHEMA, WORLD_DOCUMENT_SCHEMA_VERSION, errors)) {
    return result(errors)
  }
  validateMetrics(value.metrics, errors)
  if (!isPlainObject(value.features)) {
    errors.push('$.features doit être un objet')
  } else {
    for (const key of Object.keys(value.features)) {
      if (!WORLD_DOCUMENT_COLLECTIONS.includes(key)) {
        errors.push(`$.features.${key} est une collection inconnue`)
      }
    }
    for (const collection of WORLD_DOCUMENT_COLLECTIONS) {
      validateUuidRecord(value.features[collection], `$.features.${collection}`, errors)
    }
  }
  return result(errors)
}

export function assertWorldDocument(value) {
  const validation = validateWorldDocument(value)
  if (!validation.valid) throw new WorldContractError('WorldDocument', validation.errors)
  return value
}

export function createWorldDocument({ battlemapId = null, metrics = {}, features = {} } = {}) {
  assertKnownCollections(features, WORLD_DOCUMENT_COLLECTIONS, '$.features', 'WorldDocument')
  const collections = Object.fromEntries(WORLD_DOCUMENT_COLLECTIONS.map(name => [
    name,
    cloneValue(features[name] ?? {}),
  ]))
  const document = {
    schema: WORLD_DOCUMENT_SCHEMA,
    version: WORLD_DOCUMENT_SCHEMA_VERSION,
    battlemapId,
    metrics: createWorldMetrics(metrics),
    features: collections,
  }
  assertWorldDocument(document)
  return deepFreeze(document)
}

export function validateWorldRuntimeState(value) {
  const errors = []
  if (!validateEnvelope(value, WORLD_RUNTIME_SCHEMA, WORLD_RUNTIME_SCHEMA_VERSION, errors)) {
    return result(errors)
  }
  if (!Number.isInteger(value.worldRevision) || value.worldRevision < 0) {
    errors.push('$.worldRevision doit être un entier positif ou nul')
  }
  validateUuidRecord(value.featureStates, '$.featureStates', errors)
  validateUuidRecord(value.effectInstances, '$.effectInstances', errors)
  return result(errors)
}

export function assertWorldRuntimeState(value) {
  const validation = validateWorldRuntimeState(value)
  if (!validation.valid) throw new WorldContractError('WorldRuntimeState', validation.errors)
  return value
}

export function createWorldRuntimeState({
  battlemapId = null,
  worldRevision = 0,
  featureStates = {},
  effectInstances = {},
} = {}) {
  const runtime = {
    schema: WORLD_RUNTIME_SCHEMA,
    version: WORLD_RUNTIME_SCHEMA_VERSION,
    battlemapId,
    worldRevision,
    featureStates: cloneValue(featureStates),
    effectInstances: cloneValue(effectInstances),
  }
  assertWorldRuntimeState(runtime)
  return deepFreeze(runtime)
}

export function validateWorldSnapshot(value) {
  const errors = []
  if (!validateEnvelope(value, WORLD_SNAPSHOT_SCHEMA, WORLD_SNAPSHOT_SCHEMA_VERSION, errors)) {
    return result(errors)
  }
  if (!Number.isInteger(value.worldRevision) || value.worldRevision < 0) {
    errors.push('$.worldRevision doit être un entier positif ou nul')
  }
  validateMetrics(value.metrics, errors)
  validateNamedArrays(value.spatial, WORLD_SNAPSHOT_COLLECTIONS, '$.spatial', errors)
  return result(errors)
}

export function assertWorldSnapshot(value) {
  const validation = validateWorldSnapshot(value)
  if (!validation.valid) throw new WorldContractError('WorldSnapshot', validation.errors)
  return value
}

export function createWorldSnapshot({
  battlemapId = null,
  worldRevision = 0,
  metrics = DEFAULT_WORLD_METRICS,
  spatial = {},
} = {}) {
  assertKnownCollections(spatial, WORLD_SNAPSHOT_COLLECTIONS, '$.spatial', 'WorldSnapshot')
  const collections = Object.fromEntries(WORLD_SNAPSHOT_COLLECTIONS.map(name => [
    name,
    cloneValue(spatial[name] ?? []),
  ]))
  const snapshot = {
    schema: WORLD_SNAPSHOT_SCHEMA,
    version: WORLD_SNAPSHOT_SCHEMA_VERSION,
    battlemapId,
    worldRevision,
    metrics: createWorldMetrics(metrics),
    spatial: collections,
  }
  assertWorldSnapshot(snapshot)
  return deepFreeze(snapshot)
}
