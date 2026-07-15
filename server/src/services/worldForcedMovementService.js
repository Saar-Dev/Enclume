import { randomUUID } from 'node:crypto'

import db from '../db/knex.js'
import {
  dbPositionToWorldPoint,
  normalizeWorldPoint,
  worldPointToDbPosition,
} from '../../../shared/world/worldMetrics.js'
import { createOccupancyIndex, createSpatialIndex } from '../../../shared/world/spatialIndex.js'
import {
  dynamicOccupantsFromRows,
  getBattlemapNavigationGraph,
} from './worldMovementService.js'
import {
  loadBattlemapRuntimeContext,
  pathEffectEvents,
  persistWorldEffectEvents,
} from './worldEffectService.js'
import {
  reconcileElevatorStatesInTransaction,
  syncTokenElevatorPassenger,
} from './worldElevatorService.js'

const EPSILON = 1e-9

function clean(value) {
  const rounded = Math.round(Number(value) * 1e9) / 1e9
  return Object.is(rounded, -0) ? 0 : rounded
}

function pointPlusSteps(point, direction, stepSize, step) {
  return Object.freeze({
    x: clean(point.x + direction.x * stepSize * step),
    y: point.y,
    z: clean(point.z + direction.z * stepSize * step),
  })
}

function nearestStablePoint(graph, candidate, maxSnapDistance) {
  let selected = null
  for (const node of graph?.nodes || []) {
    if (node.kind !== 'support' || node.stable === false || node.mobile === true) continue
    const distance = Math.hypot(
      node.point.x - candidate.x,
      node.point.y - candidate.y,
      node.point.z - candidate.z,
    )
    if (distance > maxSnapDistance || (selected && distance >= selected.distance)) continue
    selected = { point: node.point, distance }
  }
  return selected?.point || null
}

export function resolveRigidPairSteps({
  snapshot,
  graph,
  actorStart,
  actorProfile = {},
  entityStart,
  entityProfile = {},
  destination,
  maxSteps,
  occupants = [],
  excludeOccupantIds = [],
} = {}) {
  const actorOrigin = normalizeWorldPoint(actorStart, 'actorStart')
  const entityOrigin = normalizeWorldPoint(entityStart, 'entityStart')
  const requested = normalizeWorldPoint(destination, 'destination')
  const stepSize = Number(snapshot?.metrics?.worldUnitsPerCell || 1)
  const dx = requested.x - entityOrigin.x
  const dz = requested.z - entityOrigin.z
  if (Math.abs(dx) <= EPSILON && Math.abs(dz) <= EPSILON) {
    return Object.freeze({ status: 'same-position', stepsCompleted: 0, actorEnd: actorOrigin, entityEnd: entityOrigin, actorSegments: [] })
  }
  if (Math.abs(dx) > EPSILON && Math.abs(dz) > EPSILON && Math.abs(Math.abs(dx) - Math.abs(dz)) > EPSILON) {
    return Object.freeze({ status: 'invalid-direction', stepsCompleted: 0, actorEnd: actorOrigin, entityEnd: entityOrigin, actorSegments: [] })
  }

  const direction = Object.freeze({ x: Math.sign(dx), z: Math.sign(dz) })
  const requestedSteps = Math.floor(Math.max(Math.abs(dx), Math.abs(dz)) / stepSize + EPSILON)
  const stepLimit = Math.min(Math.max(0, Math.floor(Number(maxSteps) || 0)), requestedSteps)
  const spatial = createSpatialIndex(snapshot)
  const occupancy = createOccupancyIndex(occupants)
  const maxSnapDistance = Math.max(0.05, stepSize * 0.6)
  let actorEnd = actorOrigin
  let entityEnd = entityOrigin
  const actorSegments = []

  for (let step = 1; step <= stepLimit; step++) {
    const actorCandidate = pointPlusSteps(actorOrigin, direction, stepSize, step)
    const entityCandidate = pointPlusSteps(entityOrigin, direction, stepSize, step)
    const nextActor = nearestStablePoint(graph, actorCandidate, maxSnapDistance)
    const nextEntity = nearestStablePoint(graph, entityCandidate, maxSnapDistance)
    if (!nextActor || !nextEntity) break
    if (!spatial.isSegmentClear(actorEnd, nextActor, actorProfile)) break
    if (!spatial.isSegmentClear(entityEnd, nextEntity, entityProfile)) break
    if (!occupancy.canOccupy(nextActor, actorProfile, { excludeIds: excludeOccupantIds })) break
    if (!occupancy.canOccupy(nextEntity, entityProfile, { excludeIds: excludeOccupantIds })) break

    actorSegments.push(Object.freeze({
      id: `forced:${step}`,
      from: actorEnd,
      to: nextActor,
      mode: 'forced',
      allowPartial: false,
    }))
    actorEnd = nextActor
    entityEnd = nextEntity
  }

  return Object.freeze({
    status: actorSegments.length === stepLimit && stepLimit > 0 ? 'destination' : 'blocked',
    stepsCompleted: actorSegments.length,
    actorEnd,
    entityEnd,
    actorSegments: Object.freeze(actorSegments),
  })
}

function entityProfile(entity) {
  const states = entity.states || []
  const state = states[entity.current_state_id] ?? states[0] ?? null
  const collider = state?.collider || {}
  return Object.freeze({
    radius: Number(collider.radius || Math.max(collider.width || 1, collider.depth || 1) / 2),
    height: Number(collider.height || 1),
    maxStepHeight: Number(collider.maxStepHeight || 0.5),
  })
}

export async function executeBattlemapRigidPairMovement({
  battlemapId,
  tokenId,
  entityId,
  destination,
  maxSteps,
  actorProfile = {},
} = {}) {
  return db.transaction(async trx => {
    let battlemap = await trx('battlemaps').where({ id: battlemapId }).forUpdate().first()
    if (!battlemap) return Object.freeze({ status: 'battlemap-not-found', moved: false })
    const elevatorRuntime = await reconcileElevatorStatesInTransaction({ trx, battlemap })
    battlemap = elevatorRuntime.battlemap

    const [tokens, entityRows] = await Promise.all([
      trx('tokens').where({ battlemap_id: battlemapId }).forUpdate(),
      trx('entities').where({ battlemap_id: battlemapId }).forUpdate(),
    ])
    const token = tokens.find(row => row.id === tokenId)
    const rawEntity = entityRows.find(row => row.id === entityId)
    if (!token || !rawEntity) return Object.freeze({ status: 'occupant-not-found', moved: false })
    if (token.position_space !== 'world-feet') return Object.freeze({ status: 'legacy-position', moved: false })

    const blueprintIds = [...new Set(entityRows.map(row => row.blueprint_id).filter(Boolean))]
    const blueprints = blueprintIds.length
      ? await trx('entity_blueprints').whereIn('id', blueprintIds).select('id', 'states')
      : []
    const blueprintById = new Map(blueprints.map(row => [row.id, row]))
    const entities = entityRows.map(row => ({
      ...row,
      states: blueprintById.get(row.blueprint_id)?.states || [],
    }))
    const entity = entities.find(row => row.id === entityId)
    const runtimeContext = await loadBattlemapRuntimeContext(battlemap, trx)
    const graph = getBattlemapNavigationGraph(battlemap, actorProfile, runtimeContext)
    const result = resolveRigidPairSteps({
      snapshot: runtimeContext.snapshot,
      graph,
      actorStart: dbPositionToWorldPoint(token),
      actorProfile,
      entityStart: dbPositionToWorldPoint(entity),
      entityProfile: entityProfile(entity),
      destination,
      maxSteps,
      occupants: dynamicOccupantsFromRows(tokens, entities),
      excludeOccupantIds: [tokenId, entityId],
    })
    const elevatorMeta = Object.freeze({
      changed: elevatorRuntime.changed,
      runtimeRevision: elevatorRuntime.runtimeRevision,
      passengerTokens: elevatorRuntime.passengerTokens,
    })
    if (result.stepsCompleted === 0) {
      return Object.freeze({ status: result.status, moved: false, result, elevatorRuntime: elevatorMeta })
    }

    const [updatedEntity] = await trx('entities')
      .where({ id: entityId })
      .update({ ...worldPointToDbPosition(result.entityEnd), updated_at: trx.fn.now() })
      .returning('*')
    const [updatedToken] = await trx('tokens')
      .where({ id: tokenId })
      .update({ ...worldPointToDbPosition(result.actorEnd), updated_at: trx.fn.now() })
      .returning('*')
    const elevatorPassenger = await syncTokenElevatorPassenger({
      trx,
      battlemap,
      tokenId,
      end: result.actorEnd,
      snapshot: runtimeContext.snapshot,
      runtimeStates: runtimeContext.runtimeState.featureStates,
    })
    const nextRuntimeRevision = Number(battlemap.runtime_revision || 0) + 1
    await trx('battlemaps').where({ id: battlemapId }).update({ runtime_revision: nextRuntimeRevision })
    const effectEvents = pathEffectEvents(runtimeContext.regions, {
      pathId: randomUUID(),
      segments: result.actorSegments,
    })
    await persistWorldEffectEvents({
      trx,
      battlemapId,
      tokenId,
      runtimeRevision: nextRuntimeRevision,
      events: effectEvents,
    })
    return Object.freeze({
      status: result.status,
      moved: true,
      result,
      token: updatedToken,
      entity: updatedEntity,
      effectEvents,
      runtimeRevision: nextRuntimeRevision,
      elevatorPassenger,
      elevatorPassengerTokens: elevatorRuntime.passengerTokens,
      elevatorRuntime: Object.freeze({ ...elevatorMeta, runtimeRevision: nextRuntimeRevision }),
    })
  })
}
