import { randomUUID } from 'node:crypto'

import db from '../db/knex.js'
import {
  dbPositionToWorldPoint,
  normalizeWorldPoint,
  worldPointToDbPosition,
} from '../../../shared/world/worldMetrics.js'
import { buildNavigationGraph, planWorldPath } from '../../../shared/world/navigation.js'
import { createOccupancyIndex } from '../../../shared/world/spatialIndex.js'
import { getBattlemapWorldSnapshot } from './worldService.js'
import {
  loadBattlemapRuntimeContext,
  pathEffectEvents,
  persistWorldEffectEvents,
} from './worldEffectService.js'
import {
  reconcileBattlemapElevators,
  reconcileElevatorStatesInTransaction,
  syncTokenElevatorPassenger,
} from './worldElevatorService.js'

const MAX_GRAPH_CACHE_ENTRIES = 32
const graphCache = new Map()

function graphKey(battlemap, actorProfile) {
  return [
    battlemap.id,
    Number(battlemap.world_revision || 0),
    Number(battlemap.runtime_revision || 0),
    Number(actorProfile.radius || 0.35),
    Number(actorProfile.height || 1.8),
    Number(actorProfile.maxStepHeight || 0.5),
  ].join(':')
}

function trimGraphCache() {
  while (graphCache.size > MAX_GRAPH_CACHE_ENTRIES) {
    graphCache.delete(graphCache.keys().next().value)
  }
}

export function getBattlemapNavigationGraph(battlemap, actorProfile = {}, runtimeContext = null) {
  const key = graphKey(battlemap, actorProfile)
  const cached = graphCache.get(key)
  if (cached) return cached
  const snapshot = runtimeContext?.snapshot || getBattlemapWorldSnapshot(battlemap)
  const graph = buildNavigationGraph(snapshot, {
    actorProfile,
    effectRegions: runtimeContext?.regions || snapshot.spatial.regions,
  })
  graphCache.set(key, graph)
  trimGraphCache()
  return graph
}

export function invalidateBattlemapNavigation(battlemapId) {
  const prefix = `${battlemapId}:`
  for (const key of graphCache.keys()) {
    if (key.startsWith(prefix)) graphCache.delete(key)
  }
}

function entityState(entity) {
  const states = entity.states || []
  return states[entity.current_state_id] ?? states[0] ?? null
}

export function dynamicOccupantsFromRows(tokens = [], entities = []) {
  const occupants = []
  for (const token of tokens) {
    if (token.layer === 'gm' || token.position_space !== 'world-feet') continue
    occupants.push({
      id: token.id,
      kind: 'token',
      point: dbPositionToWorldPoint(token),
      actorProfile: { radius: 0.35, height: 1.8, maxStepHeight: 0.5 },
    })
  }
  for (const entity of entities) {
    const state = entityState(entity)
    if ((state?.is_blocking ?? true) === false) continue
    const collider = state?.collider || {}
    occupants.push({
      id: entity.id,
      kind: 'entity',
      point: dbPositionToWorldPoint(entity),
      actorProfile: {
        radius: Number(collider.radius || Math.max(collider.width || 1, collider.depth || 1) / 2),
        height: Number(collider.height || 1),
        maxStepHeight: 0.5,
      },
    })
  }
  return Object.freeze(occupants)
}

export async function loadBattlemapDynamicOccupants(battlemapId) {
  const [tokens, entities] = await Promise.all([
    db('tokens').where({ battlemap_id: battlemapId }),
    db('entities')
      .where({ 'entities.battlemap_id': battlemapId })
      .join('entity_blueprints', 'entities.blueprint_id', 'entity_blueprints.id')
      .select(
        'entities.id', 'entities.pos_x', 'entities.pos_y', 'entities.pos_z',
        'entities.current_state_id', 'entity_blueprints.states',
      ),
  ])
  return dynamicOccupantsFromRows(tokens, entities)
}

export function resolvePlacementPoint({
  graph,
  destination,
  occupants = [],
  maxSnapDistance = 1.25,
} = {}) {
  const requested = normalizeWorldPoint(destination, 'destination')
  const occupancy = createOccupancyIndex(occupants)
  let selected = null
  for (const node of graph?.nodes || []) {
    if (node.kind !== 'support' || node.stable === false || node.mobile === true) continue
    const distance = Math.hypot(
      node.point.x - requested.x,
      node.point.y - requested.y,
      node.point.z - requested.z,
    )
    if (distance > maxSnapDistance || (selected && distance >= selected.distance)) continue
    selected = { node, distance }
  }
  if (!selected || !occupancy.canOccupy(selected.node.point, graph.actorProfile)) return null
  return selected.node.point
}

export async function resolveBattlemapPlacement({
  battlemap,
  destination,
  actorProfile = {},
} = {}) {
  const elevatorRuntime = await reconcileBattlemapElevators({ battlemapId: battlemap.id })
  const currentBattlemap = elevatorRuntime.battlemap
  const runtimeContext = await loadBattlemapRuntimeContext(currentBattlemap)
  const graph = getBattlemapNavigationGraph(currentBattlemap, actorProfile, runtimeContext)
  const occupants = await loadBattlemapDynamicOccupants(currentBattlemap.id)
  return resolvePlacementPoint({ graph, destination, occupants })
}

export async function planBattlemapTokenMovement({
  battlemap,
  token,
  destination,
  authorizedBudgetM,
  actorProfile = {},
} = {}) {
  const elevatorRuntime = await reconcileBattlemapElevators({ battlemapId: battlemap.id })
  const currentBattlemap = elevatorRuntime.battlemap
  const currentToken = await db('tokens')
    .where({ id: token.id, battlemap_id: currentBattlemap.id })
    .first() || token
  const runtimeContext = await loadBattlemapRuntimeContext(currentBattlemap)
  const snapshot = runtimeContext.snapshot
  const graph = getBattlemapNavigationGraph(currentBattlemap, actorProfile, runtimeContext)
  const occupants = await loadBattlemapDynamicOccupants(currentBattlemap.id)
  const result = planWorldPath({
    snapshot,
    graph,
    from: dbPositionToWorldPoint(currentToken),
    to: destination,
    budgetM: authorizedBudgetM,
    actorProfile,
    occupants,
    excludeOccupantIds: [currentToken.id],
    pathId: randomUUID(),
  })
  const elevatorMeta = Object.freeze({
    changed: elevatorRuntime.changed,
    runtimeRevision: elevatorRuntime.runtimeRevision,
    passengerTokens: elevatorRuntime.passengerTokens,
  })
  if (!result.plan) return Object.freeze({ ...result, elevatorRuntime: elevatorMeta })
  return Object.freeze({
    ...result,
    runtimeRevision: runtimeContext.runtimeRevision,
    effectEvents: pathEffectEvents(runtimeContext.regions, result.plan),
    elevatorRuntime: elevatorMeta,
  })
}

export async function executeBattlemapTokenMovement({
  battlemapId,
  tokenId,
  destination,
  authorizedBudgetM,
  actorProfile = {},
} = {}) {
  return db.transaction(async trx => {
    let battlemap = await trx('battlemaps').where({ id: battlemapId }).forUpdate().first()
    if (!battlemap) return Object.freeze({ status: 'battlemap-not-found', moved: false })

    const elevatorRuntime = await reconcileElevatorStatesInTransaction({ trx, battlemap })
    battlemap = elevatorRuntime.battlemap
    const elevatorMeta = Object.freeze({
      changed: elevatorRuntime.changed,
      runtimeRevision: elevatorRuntime.runtimeRevision,
      passengerTokens: elevatorRuntime.passengerTokens,
    })

    const tokens = await trx('tokens').where({ battlemap_id: battlemapId }).forUpdate()
    const token = tokens.find(item => item.id === tokenId)
    if (!token) return Object.freeze({ status: 'token-not-found', moved: false })
    if (token.position_space !== 'world-feet') {
      return Object.freeze({ status: 'legacy-position', moved: false })
    }

    const entityRows = await trx('entities').where({ battlemap_id: battlemapId }).forUpdate()
    const blueprintIds = [...new Set(entityRows.map(entity => entity.blueprint_id).filter(Boolean))]
    const blueprints = blueprintIds.length
      ? await trx('entity_blueprints').whereIn('id', blueprintIds).select('id', 'states')
      : []
    const blueprintById = new Map(blueprints.map(blueprint => [blueprint.id, blueprint]))
    const entities = entityRows.map(entity => ({
      ...entity,
      states: blueprintById.get(entity.blueprint_id)?.states || [],
    }))

    const runtimeContext = await loadBattlemapRuntimeContext(battlemap, trx)
    const snapshot = runtimeContext.snapshot
    const graph = getBattlemapNavigationGraph(battlemap, actorProfile, runtimeContext)
    const result = planWorldPath({
      snapshot,
      graph,
      from: dbPositionToWorldPoint(token),
      to: destination,
      budgetM: authorizedBudgetM,
      actorProfile,
      occupants: dynamicOccupantsFromRows(tokens, entities),
      excludeOccupantIds: [token.id],
      pathId: randomUUID(),
    })
    if (result.status === 'unreachable') {
      return Object.freeze({
        status: 'unreachable', moved: false, result,
        elevatorPassengerTokens: elevatorRuntime.passengerTokens,
        elevatorRuntime: elevatorMeta,
      })
    }

    const end = result.plan.end || result.snappedFrom
    const effectEvents = pathEffectEvents(runtimeContext.regions, result.plan)
    const current = dbPositionToWorldPoint(token)
    const moved = end && (
      Math.abs(end.x - current.x) > 1e-9
      || Math.abs(end.y - current.y) > 1e-9
      || Math.abs(end.z - current.z) > 1e-9
    )
    if (!moved) {
      return Object.freeze({
        status: result.status, moved: false, token, result, effectEvents,
        runtimeRevision: Number(battlemap.runtime_revision || 0),
        elevatorPassengerTokens: elevatorRuntime.passengerTokens,
        elevatorRuntime: elevatorMeta,
      })
    }

    const [updatedToken] = await trx('tokens')
      .where({ id: token.id })
      .update({ ...worldPointToDbPosition(end), updated_at: trx.fn.now() })
      .returning('*')
    const elevatorPassenger = await syncTokenElevatorPassenger({
      trx,
      battlemap,
      tokenId: token.id,
      end,
      snapshot,
      runtimeStates: runtimeContext.runtimeState.featureStates,
    })
    const [runtime] = await trx('battlemaps')
      .where({ id: battlemapId })
      .update({ runtime_revision: Number(battlemap.runtime_revision || 0) + 1 })
      .returning('runtime_revision')
    await persistWorldEffectEvents({
      trx,
      battlemapId,
      tokenId: token.id,
      runtimeRevision: runtime.runtime_revision,
      events: effectEvents,
    })
    return Object.freeze({
      status: result.status,
      moved: true,
      token: updatedToken,
      result,
      effectEvents,
      runtimeRevision: runtime.runtime_revision,
      elevatorPassenger,
      elevatorPassengerTokens: elevatorRuntime.passengerTokens,
      elevatorRuntime: Object.freeze({
        ...elevatorMeta,
        runtimeRevision: runtime.runtime_revision,
      }),
    })
  })
}
