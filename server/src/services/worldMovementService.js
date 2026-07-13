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

const MAX_GRAPH_CACHE_ENTRIES = 32
const graphCache = new Map()

function graphKey(battlemap, actorProfile) {
  return [
    battlemap.id,
    Number(battlemap.world_revision || 0),
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

export function getBattlemapNavigationGraph(battlemap, actorProfile = {}) {
  const key = graphKey(battlemap, actorProfile)
  const cached = graphCache.get(key)
  if (cached) return cached
  const snapshot = getBattlemapWorldSnapshot(battlemap)
  const graph = buildNavigationGraph(snapshot, { actorProfile })
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
    if (node.kind !== 'support' || node.stable === false) continue
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
  const graph = getBattlemapNavigationGraph(battlemap, actorProfile)
  const occupants = await loadBattlemapDynamicOccupants(battlemap.id)
  return resolvePlacementPoint({ graph, destination, occupants })
}

export async function planBattlemapTokenMovement({
  battlemap,
  token,
  destination,
  authorizedBudgetM,
  actorProfile = {},
} = {}) {
  const snapshot = getBattlemapWorldSnapshot(battlemap)
  const graph = getBattlemapNavigationGraph(battlemap, actorProfile)
  const occupants = await loadBattlemapDynamicOccupants(battlemap.id)
  return planWorldPath({
    snapshot,
    graph,
    from: dbPositionToWorldPoint(token),
    to: destination,
    budgetM: authorizedBudgetM,
    actorProfile,
    occupants,
    excludeOccupantIds: [token.id],
    pathId: randomUUID(),
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
    const battlemap = await trx('battlemaps').where({ id: battlemapId }).forUpdate().first()
    if (!battlemap) return Object.freeze({ status: 'battlemap-not-found', moved: false })

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

    const snapshot = getBattlemapWorldSnapshot(battlemap)
    const graph = getBattlemapNavigationGraph(battlemap, actorProfile)
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
      return Object.freeze({ status: 'unreachable', moved: false, result })
    }

    const end = result.plan.end || result.snappedFrom
    const current = dbPositionToWorldPoint(token)
    const moved = end && (
      Math.abs(end.x - current.x) > 1e-9
      || Math.abs(end.y - current.y) > 1e-9
      || Math.abs(end.z - current.z) > 1e-9
    )
    if (!moved) {
      return Object.freeze({ status: result.status, moved: false, token, result })
    }

    const [updatedToken] = await trx('tokens')
      .where({ id: token.id })
      .update({ ...worldPointToDbPosition(end), updated_at: trx.fn.now() })
      .returning('*')
    const [runtime] = await trx('battlemaps')
      .where({ id: battlemapId })
      .update({ runtime_revision: Number(battlemap.runtime_revision || 0) + 1 })
      .returning('runtime_revision')
    return Object.freeze({
      status: result.status,
      moved: true,
      token: updatedToken,
      result,
      runtimeRevision: runtime.runtime_revision,
    })
  })
}
