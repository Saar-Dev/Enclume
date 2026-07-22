import { randomUUID } from 'node:crypto'

import db from '../db/knex.js'
import {
  commandElevator,
  createInitialElevatorState,
  elevatorPassengerWorldPoint,
  normalizeElevatorDefinition,
  normalizeElevatorState,
  reconcileElevatorState,
} from '../../../shared/world/elevatorRuntime.js'
import { prepareSurfaceData } from '../../../shared/world/surfaceDocument.js'
import { worldPointToDbPosition } from '../../../shared/world/worldMetrics.js'

const EPSILON = 1e-6

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function statePayload(state) {
  return JSON.parse(JSON.stringify(state))
}

function passengerPayload(row) {
  return Object.freeze({
    battlemapId: row.battlemap_id,
    elevatorId: row.elevator_id,
    tokenId: row.token_id,
    localPosition: Object.freeze({ ...row.local_position }),
    boardedAt: row.boarded_at,
    updatedAt: row.updated_at,
  })
}

export function elevatorDefinitionsFromBattlemap(battlemap) {
  const surface = prepareSurfaceData(battlemap?.surface_data || {}, {
    battlemapId: battlemap?.id || null,
  }).surfaceData
  return Object.freeze(Object.values(surface.connectors)
    .filter(connector => connector.type === 'elevator')
    .map(connector => normalizeElevatorDefinition(connector, { storyHeight: surface.storyHeight })))
}

export function findCabinSupportForPoint(snapshot, point) {
  return (snapshot?.spatial?.supports || []).find(support => (
    support.kind === 'elevator-cabin'
    && Math.abs(Number(support.y) - Number(point.y)) <= EPSILON
    && Number(point.x) >= support.bounds.min.x - EPSILON
    && Number(point.x) <= support.bounds.max.x + EPSILON
    && Number(point.z) >= support.bounds.min.z - EPSILON
    && Number(point.z) <= support.bounds.max.z + EPSILON
  )) || null
}

export function elevatorLocalPosition(definition, state, worldPoint) {
  return Object.freeze({
    x: Number(worldPoint.x) - Number(state.positionX ?? definition.x),
    y: Number(worldPoint.y) - state.positionY,
    z: Number(worldPoint.z) - Number(state.positionZ ?? definition.z),
  })
}

async function persistElevatorState(trx, {
  battlemapId,
  elevatorId,
  state,
  currentRow = null,
  userId = null,
}) {
  const version = Number(currentRow?.version || 0) + 1
  const [row] = await trx('world_feature_states').insert({
    battlemap_id: battlemapId,
    feature_id: elevatorId,
    state: statePayload(state),
    version,
    updated_by: userId,
  }).onConflict(['battlemap_id', 'feature_id']).merge({
    state: statePayload(state),
    version,
    updated_by: userId,
    updated_at: trx.fn.now(),
  }).returning('*')
  return row
}

async function moveAttachedPassengers(trx, definition, state, passengerRows) {
  const updatedTokens = []
  for (const passenger of passengerRows) {
    const point = elevatorPassengerWorldPoint(definition, state, passenger.local_position)
    const [token] = await trx('tokens')
      .where({ id: passenger.token_id, battlemap_id: passenger.battlemap_id })
      .update({ ...worldPointToDbPosition(point), updated_at: trx.fn.now() })
      .returning(['id', 'pos_x', 'pos_y', 'pos_z', 'position_space', 'updated_at'])
    if (token) updatedTokens.push(token)
  }
  return updatedTokens
}

async function bumpRuntimeRevision(trx, battlemap) {
  const next = Number(battlemap.runtime_revision || 0) + 1
  await trx('battlemaps').where({ id: battlemap.id }).update({ runtime_revision: next })
  return next
}

/**
 * Avance l'horloge de toutes les cabines dans la transaction qui verrouille déjà la battlemap.
 * Aucun timer mémoire n'est nécessaire : les échéances durables suffisent après un redémarrage.
 */
export async function reconcileElevatorStatesInTransaction({
  trx,
  battlemap,
  now = Date.now(),
  bumpRevision = true,
} = {}) {
  const definitions = elevatorDefinitionsFromBattlemap(battlemap)
  const definitionIds = definitions.map(definition => definition.id)
  const stateRows = definitionIds.length
    ? await trx('world_feature_states')
      .where({ battlemap_id: battlemap.id })
      .whereIn('feature_id', definitionIds)
      .forUpdate()
    : []
  const passengerRows = await trx('world_elevator_passengers')
    .where({ battlemap_id: battlemap.id })
    .forUpdate()
  const rowById = new Map(stateRows.map(row => [row.feature_id, row]))
  const passengersByElevator = new Map()
  for (const passenger of passengerRows) {
    const rows = passengersByElevator.get(passenger.elevator_id) || []
    rows.push(passenger)
    passengersByElevator.set(passenger.elevator_id, rows)
  }

  const states = {}
  const passengerTokens = new Map()
  let changed = false
  for (const definition of definitions) {
    const row = rowById.get(definition.id)
    const initial = createInitialElevatorState(definition, { now })
    const current = normalizeElevatorState(definition, row?.state || initial)
    const next = reconcileElevatorState(definition, current, now)
    states[definition.id] = next
    if (!row || sameValue(current, next)) continue
    await persistElevatorState(trx, {
      battlemapId: battlemap.id,
      elevatorId: definition.id,
      state: next,
      currentRow: row,
    })
    for (const token of await moveAttachedPassengers(
      trx,
      definition,
      next,
      passengersByElevator.get(definition.id) || [],
    )) passengerTokens.set(token.id, token)
    changed = true
  }

  const validIds = new Set(definitionIds)
  const orphanTokenIds = passengerRows
    .filter(passenger => !validIds.has(passenger.elevator_id))
    .map(passenger => passenger.token_id)
  if (orphanTokenIds.length) {
    await trx('world_elevator_passengers')
      .where({ battlemap_id: battlemap.id })
      .whereIn('token_id', orphanTokenIds)
      .del()
    changed = true
  }

  const runtimeRevision = changed && bumpRevision
    ? await bumpRuntimeRevision(trx, battlemap)
    : Number(battlemap.runtime_revision || 0)
  return Object.freeze({
    battlemap: Object.freeze({ ...battlemap, runtime_revision: runtimeRevision }),
    definitions,
    states: Object.freeze(states),
    changed,
    runtimeRevision,
    passengerTokens: Object.freeze([...passengerTokens.values()]),
  })
}

export async function reconcileBattlemapElevators({
  battlemapId,
  now = Date.now(),
  database = db,
} = {}) {
  return database.transaction(async trx => {
    const battlemap = await trx('battlemaps').where({ id: battlemapId }).forUpdate().first()
    if (!battlemap) throw new RangeError('Battlemap inconnue')
    return reconcileElevatorStatesInTransaction({ trx, battlemap, now })
  })
}

export async function listBattlemapElevators({
  battlemapId,
  now = Date.now(),
  database = db,
} = {}) {
  const runtime = await reconcileBattlemapElevators({ battlemapId, now, database })
  const rows = await database('world_elevator_passengers')
    .where({ battlemap_id: battlemapId })
    .orderBy(['elevator_id', 'boarded_at', 'token_id'])
  return Object.freeze({
    runtimeRevision: runtime.runtimeRevision,
    changed: runtime.changed,
    definitions: runtime.definitions,
    states: runtime.states,
    passengers: Object.freeze(rows.map(passengerPayload)),
    passengerTokens: runtime.passengerTokens,
  })
}

export async function commandBattlemapElevator({
  battlemapId,
  elevatorId,
  command,
  userId = null,
  now = Date.now(),
  database = db,
} = {}) {
  return database.transaction(async trx => {
    const battlemap = await trx('battlemaps').where({ id: battlemapId }).forUpdate().first()
    if (!battlemap) throw new RangeError('Battlemap inconnue')
    const reconciled = await reconcileElevatorStatesInTransaction({
      trx, battlemap, now, bumpRevision: false,
    })
    const definition = reconciled.definitions.find(item => item.id === elevatorId)
    if (!definition) throw new RangeError('Ascenseur inconnu')
    const row = await trx('world_feature_states')
      .where({ battlemap_id: battlemapId, feature_id: elevatorId })
      .forUpdate()
      .first()
    const current = reconciled.states[elevatorId]
      || createInitialElevatorState(definition, { now })
    const next = commandElevator(definition, current, {
      ...command,
      requestId: command?.requestId || randomUUID(),
      requestedBy: command?.requestedBy || userId,
    }, now)
    const stateChanged = !sameValue(current, next)
    const passengerTokens = new Map(reconciled.passengerTokens.map(token => [token.id, token]))
    if (stateChanged) {
      await persistElevatorState(trx, {
        battlemapId,
        elevatorId,
        state: next,
        currentRow: row,
        userId,
      })
      const passengers = await trx('world_elevator_passengers')
        .where({ battlemap_id: battlemapId, elevator_id: elevatorId })
        .forUpdate()
      for (const token of await moveAttachedPassengers(trx, definition, next, passengers)) {
        passengerTokens.set(token.id, token)
      }
    }
    const changed = reconciled.changed || stateChanged
    const runtimeRevision = changed
      ? await bumpRuntimeRevision(trx, reconciled.battlemap)
      : Number(battlemap.runtime_revision || 0)
    return Object.freeze({
      elevatorId,
      definition,
      state: next,
      changed,
      runtimeRevision,
      passengerTokens: Object.freeze([...passengerTokens.values()]),
    })
  })
}

/** Met à jour l'attachement après le déplacement autoritaire d'un token. */
export async function syncTokenElevatorPassenger({
  trx,
  battlemap,
  tokenId,
  end,
  snapshot,
  runtimeStates = {},
} = {}) {
  const support = findCabinSupportForPoint(snapshot, end)
  await trx('world_elevator_passengers').where({ token_id: tokenId }).del()
  if (!support) return null
  const definition = elevatorDefinitionsFromBattlemap(battlemap)
    .find(item => item.id === support.sourceId)
  if (!definition) return null
  const state = normalizeElevatorState(definition, runtimeStates[definition.id]
    || createInitialElevatorState(definition))
  const localPosition = elevatorLocalPosition(definition, state, end)
  const [row] = await trx('world_elevator_passengers').insert({
    battlemap_id: battlemap.id,
    elevator_id: definition.id,
    token_id: tokenId,
    local_position: localPosition,
    updated_at: trx.fn.now(),
  }).returning('*')
  return passengerPayload(row)
}
