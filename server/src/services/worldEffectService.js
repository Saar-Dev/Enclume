import { randomUUID } from 'node:crypto'

import db from '../db/knex.js'
import { compileSurfaceWorld } from '../../../shared/world/worldCompiler.js'
import { createWorldRuntimeState, createWorldSnapshot } from '../../../shared/world/worldContracts.js'
import {
  BUILTIN_WORLD_EFFECTS,
  collectPointEffectHooks,
  collectPathEffectEvents,
  collectTargetEffectHooks,
  compileEffectRegions,
  effectDefinitionRegistry,
  normalizeEffectDefinition,
  normalizeEffectInstance,
  propagateEffectThroughCompartments,
} from '../../../shared/world/worldEffects.js'

function definitionFromRow(row) {
  return normalizeEffectDefinition({
    key: row.effect_key,
    label: row.label,
    icon: row.icon,
    note: row.note,
    category: row.category,
    stacking: row.stacking,
    modifiers: row.modifiers || {},
    hooks: row.hooks || [],
  }, { custom: true })
}

function instanceFromRow(row) {
  return normalizeEffectInstance({
    id: row.id,
    battlemapId: row.battlemap_id,
    definitionKey: row.definition_key,
    targetKind: row.target_kind,
    targetId: row.target_id,
    volume: row.volume,
    intensity: row.intensity,
    durationRounds: row.duration_rounds,
    state: row.state,
    source: row.source,
    metadata: row.metadata,
  })
}

function serializeDefinition(definition) {
  return {
    key: definition.key,
    label: definition.label,
    icon: definition.icon,
    note: definition.note,
    category: definition.category,
    stacking: definition.stacking,
    builtin: definition.builtin,
    modifiers: definition.modifiers,
    hooks: definition.hooks,
  }
}

function ensureObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} doit être un objet`)
  return JSON.parse(JSON.stringify(value))
}

export async function loadWorldEffectDefinitions(campaignId, database = db) {
  const rows = await database('world_effect_definitions')
    .where({ campaign_id: campaignId })
    .orderBy('effect_key')
  return Object.freeze(rows.map(definitionFromRow))
}

export async function loadWorldFeatureStates(battlemapId, database = db) {
  const rows = await database('world_feature_states').where({ battlemap_id: battlemapId })
  return Object.freeze(Object.fromEntries(rows.map(row => [row.feature_id, Object.freeze({
    id: row.feature_id,
    ...(row.state || {}),
    version: Number(row.version || 1),
  })])))
}

export async function loadWorldEffectInstances(battlemapId, database = db) {
  const rows = await database('world_effect_instances')
    .where({ battlemap_id: battlemapId })
    .orderBy('created_at')
  return Object.freeze(rows.map(instanceFromRow))
}

export async function loadBattlemapRuntimeContext(battlemap, database = db) {
  const [featureStates, definitions, instances] = await Promise.all([
    loadWorldFeatureStates(battlemap.id, database),
    loadWorldEffectDefinitions(battlemap.campaign_id, database),
    loadWorldEffectInstances(battlemap.id, database),
  ])
  const runtimeState = createWorldRuntimeState({
    battlemapId: battlemap.id,
    worldRevision: Number(battlemap.runtime_revision || 0),
    featureStates,
    effectInstances: Object.fromEntries(instances.map(instance => [instance.id, instance])),
  })
  const structuralSnapshot = compileSurfaceWorld({
    battlemapId: battlemap.id,
    worldRevision: Number(battlemap.world_revision || 0),
    surfaceData: battlemap.surface_data || {},
    runtimeState,
  })
  const regions = compileEffectRegions(structuralSnapshot, { definitions, instances })
  const snapshot = createWorldSnapshot({
    battlemapId: structuralSnapshot.battlemapId,
    worldRevision: structuralSnapshot.worldRevision,
    metrics: structuralSnapshot.metrics,
    spatial: { ...structuralSnapshot.spatial, regions },
  })
  return Object.freeze({
    runtimeRevision: Number(battlemap.runtime_revision || 0),
    runtimeState,
    definitions,
    instances,
    regions,
    snapshot,
  })
}

export async function listBattlemapWorldEffects(battlemap, database = db) {
  const context = await loadBattlemapRuntimeContext(battlemap, database)
  return Object.freeze({
    runtimeRevision: context.runtimeRevision,
    definitions: Object.freeze([
      ...Object.values(BUILTIN_WORLD_EFFECTS).map(serializeDefinition),
      ...context.definitions.map(serializeDefinition),
    ]),
    instances: context.instances,
    regions: context.regions,
    featureStates: context.runtimeState.featureStates,
  })
}

export async function createCustomWorldEffectDefinition({ campaignId, input, userId, database = db }) {
  const definition = normalizeEffectDefinition(input, { custom: true })
  effectDefinitionRegistry([definition])
  const [row] = await database('world_effect_definitions').insert({
    id: randomUUID(),
    campaign_id: campaignId,
    effect_key: definition.key,
    label: definition.label,
    icon: definition.icon,
    note: definition.note,
    category: definition.category,
    stacking: definition.stacking,
    modifiers: definition.modifiers,
    hooks: definition.hooks,
    created_by: userId,
  }).returning('*')
  return definitionFromRow(row)
}

async function lockBattlemap(trx, battlemapId) {
  const battlemap = await trx('battlemaps').where({ id: battlemapId }).forUpdate().first()
  if (!battlemap) throw new RangeError('Battlemap inconnue')
  return battlemap
}

async function bumpRuntimeRevision(trx, battlemap) {
  const next = Number(battlemap.runtime_revision || 0) + 1
  await trx('battlemaps').where({ id: battlemap.id }).update({ runtime_revision: next })
  return next
}

export async function setWorldFeatureState({ battlemapId, featureId, state, userId, database = db }) {
  if (!/^[0-9a-f-]{36}$/i.test(String(featureId || ''))) throw new RangeError('featureId doit être un UUID')
  const safeState = ensureObject(state, 'state')
  return database.transaction(async trx => {
    const battlemap = await lockBattlemap(trx, battlemapId)
    const current = await trx('world_feature_states')
      .where({ battlemap_id: battlemapId, feature_id: featureId })
      .forUpdate()
      .first()
    const version = Number(current?.version || 0) + 1
    const [row] = await trx('world_feature_states')
      .insert({
        battlemap_id: battlemapId,
        feature_id: featureId,
        state: safeState,
        version,
        updated_by: userId,
      })
      .onConflict(['battlemap_id', 'feature_id'])
      .merge({ state: safeState, version, updated_by: userId, updated_at: trx.fn.now() })
      .returning('*')
    const runtimeRevision = await bumpRuntimeRevision(trx, battlemap)
    return Object.freeze({ featureId, state: row.state, version, runtimeRevision })
  })
}

export async function createWorldEffectInstance({ battlemapId, input, userId, database = db }) {
  return database.transaction(async trx => {
    const battlemap = await lockBattlemap(trx, battlemapId)
    const definitions = await loadWorldEffectDefinitions(battlemap.campaign_id, trx)
    const registry = effectDefinitionRegistry(definitions)
    const id = randomUUID()
    const instance = normalizeEffectInstance({ ...input, id, battlemapId })
    if (!registry.has(instance.definitionKey)) throw new RangeError(`Définition inconnue : ${instance.definitionKey}`)
    const [row] = await trx('world_effect_instances').insert({
      id,
      battlemap_id: battlemapId,
      definition_key: instance.definitionKey,
      target_kind: instance.targetKind,
      target_id: instance.targetId,
      volume: instance.volume,
      intensity: instance.intensity,
      duration_rounds: instance.durationRounds,
      state: instance.state,
      source: instance.source,
      metadata: instance.metadata,
      created_by: userId,
    }).returning('*')
    const runtimeRevision = await bumpRuntimeRevision(trx, battlemap)
    return Object.freeze({ instance: instanceFromRow(row), runtimeRevision })
  })
}

export async function updateWorldEffectInstance({ battlemapId, instanceId, patch, database = db }) {
  return database.transaction(async trx => {
    const battlemap = await lockBattlemap(trx, battlemapId)
    const currentRow = await trx('world_effect_instances')
      .where({ id: instanceId, battlemap_id: battlemapId })
      .forUpdate()
      .first()
    if (!currentRow) throw new RangeError("Instance d'effet inconnue")
    const current = instanceFromRow(currentRow)
    const next = normalizeEffectInstance({
      ...current,
      ...patch,
      id: current.id,
      battlemapId,
      definitionKey: patch.definitionKey || current.definitionKey,
      targetKind: patch.targetKind || current.targetKind,
      targetId: patch.targetId === undefined ? current.targetId : patch.targetId,
      volume: patch.volume === undefined ? current.volume : patch.volume,
    })
    const definitions = await loadWorldEffectDefinitions(battlemap.campaign_id, trx)
    if (!effectDefinitionRegistry(definitions).has(next.definitionKey)) {
      throw new RangeError(`Définition inconnue : ${next.definitionKey}`)
    }
    const [row] = await trx('world_effect_instances').where({ id: instanceId }).update({
      definition_key: next.definitionKey,
      target_kind: next.targetKind,
      target_id: next.targetId,
      volume: next.volume,
      intensity: next.intensity,
      duration_rounds: next.durationRounds,
      state: next.state,
      source: next.source,
      metadata: next.metadata,
      updated_at: trx.fn.now(),
    }).returning('*')
    const runtimeRevision = await bumpRuntimeRevision(trx, battlemap)
    return Object.freeze({ instance: instanceFromRow(row), runtimeRevision })
  })
}

export async function deleteWorldEffectInstance({ battlemapId, instanceId, database = db }) {
  return database.transaction(async trx => {
    const battlemap = await lockBattlemap(trx, battlemapId)
    const deleted = await trx('world_effect_instances')
      .where({ id: instanceId, battlemap_id: battlemapId })
      .del()
    if (!deleted) throw new RangeError("Instance d'effet inconnue")
    return Object.freeze({ deleted: true, runtimeRevision: await bumpRuntimeRevision(trx, battlemap) })
  })
}

export async function createPropagatedWorldEffectInstances({
  battlemapId,
  definitionKey,
  originCompartmentId,
  channel,
  intensity = 1,
  attenuation = 0.75,
  source = {},
  userId,
  database = db,
}) {
  return database.transaction(async trx => {
    const battlemap = await lockBattlemap(trx, battlemapId)
    const context = await loadBattlemapRuntimeContext(battlemap, trx)
    const registry = effectDefinitionRegistry(context.definitions)
    if (!registry.has(definitionKey)) throw new RangeError(`Définition inconnue : ${definitionKey}`)
    const propagated = propagateEffectThroughCompartments(context.snapshot, {
      originCompartmentId, channel, intensity, attenuation,
    })
    const rows = propagated.map(item => ({
      id: randomUUID(),
      battlemap_id: battlemapId,
      definition_key: definitionKey,
      target_kind: 'compartment',
      target_id: item.compartmentId,
      intensity: item.intensity,
      state: 'active',
      source: ensureObject(source, 'source'),
      metadata: { propagatedFrom: originCompartmentId, channel },
      created_by: userId,
    }))
    const inserted = rows.length ? await trx('world_effect_instances').insert(rows).returning('*') : []
    const runtimeRevision = await bumpRuntimeRevision(trx, battlemap)
    return Object.freeze({ instances: inserted.map(instanceFromRow), runtimeRevision })
  })
}

export function pathEffectEvents(regions, plan) {
  return collectPathEffectEvents(regions, plan?.segments || [])
}

export async function getBattlemapEffectHooks({
  battlemap,
  targetKind,
  targetId,
  point = null,
  event,
  database = db,
}) {
  const context = await loadBattlemapRuntimeContext(battlemap, database)
  return Object.freeze([
    ...collectTargetEffectHooks({
      definitions: context.definitions,
      instances: context.instances,
      targetKind,
      targetId,
      event,
    }),
    ...(point ? collectPointEffectHooks(context.regions, point, event) : []),
  ])
}

export async function persistWorldEffectEvents({
  trx,
  battlemapId,
  tokenId,
  runtimeRevision,
  events = [],
}) {
  if (!events.length) return []
  return trx('world_effect_events').insert(events.map(event => ({
    id: randomUUID(),
    battlemap_id: battlemapId,
    effect_instance_id: event.instanceId,
    token_id: tokenId,
    event_type: event.event,
    payload: event,
    runtime_revision: runtimeRevision,
  }))).returning('*')
}
