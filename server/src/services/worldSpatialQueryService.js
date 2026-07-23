import db from '../db/knex.js'
import {
  dbPositionToWorldPoint,
  distanceBetweenWorldPointsM,
} from '../../../shared/world/worldMetrics.js'
import { pointInsideEffectBounds } from '../../../shared/world/worldEffects.js'
import { loadBattlemapRuntimeContext } from './worldEffectService.js'
import { reconcileBattlemapElevators } from './worldElevatorService.js'

export function tokenDistanceM(sourceToken, targetToken, metrics) {
  if (sourceToken?.position_space !== 'world-feet' || targetToken?.position_space !== 'world-feet') {
    throw new RangeError('Position incompatible avec le moteur de monde')
  }
  return distanceBetweenWorldPointsM(
    dbPositionToWorldPoint(sourceToken),
    dbPositionToWorldPoint(targetToken),
    metrics,
  )
}

/**
 * Mesure autoritaire entre deux tokens. La reconciliation des ascenseurs precede la lecture :
 * une cabine en mouvement ne laisse donc jamais le combat travailler sur une position perimee.
 */
export async function measureBattlemapTokenDistance({
  sourceTokenId,
  targetTokenId,
  database = db,
} = {}) {
  console.log(`[DBG] measureBattlemapTokenDistance — début source:${sourceTokenId} target:${targetTokenId}`)
  const [initialSource, initialTarget] = await Promise.all([
    database('tokens').where({ id: sourceTokenId }).first(),
    database('tokens').where({ id: targetTokenId }).first(),
  ])
  if (!initialSource || !initialTarget) {
    return Object.freeze({ status: 'token-not-found', distanceM: null })
  }
  if (initialSource.battlemap_id !== initialTarget.battlemap_id) {
    return Object.freeze({ status: 'cross-battlemap', distanceM: null })
  }

  console.log(`[DBG] measureBattlemapTokenDistance — avant reconcileBattlemapElevators battlemap:${initialSource.battlemap_id}`)
  const elevatorRuntime = await reconcileBattlemapElevators({
    battlemapId: initialSource.battlemap_id,
    database,
  })
  console.log(`[DBG] measureBattlemapTokenDistance — après reconcileBattlemapElevators`)
  const battlemap = elevatorRuntime.battlemap
  const [sourceToken, targetToken, runtimeContext] = await Promise.all([
    database('tokens').where({ id: sourceTokenId, battlemap_id: battlemap.id }).first(),
    database('tokens').where({ id: targetTokenId, battlemap_id: battlemap.id }).first(),
    loadBattlemapRuntimeContext(battlemap, database),
  ])
  if (!sourceToken || !targetToken) {
    return Object.freeze({ status: 'token-not-found', distanceM: null })
  }
  if (sourceToken.position_space !== 'world-feet' || targetToken.position_space !== 'world-feet') {
    return Object.freeze({ status: 'legacy-position', distanceM: null })
  }

  const metrics = runtimeContext.snapshot.metrics
  const sourcePoint = dbPositionToWorldPoint(sourceToken)
  const targetPoint = dbPositionToWorldPoint(targetToken)
  return Object.freeze({
    status: 'ok',
    distanceM: distanceBetweenWorldPointsM(sourcePoint, targetPoint, metrics),
    sourceToken,
    targetToken,
    metrics,
    sourceEffectRegions: Object.freeze(runtimeContext.regions.filter(region => (
      pointInsideEffectBounds(sourcePoint, region.bounds)
    ))),
    targetEffectRegions: Object.freeze(runtimeContext.regions.filter(region => (
      pointInsideEffectBounds(targetPoint, region.bounds)
    ))),
    worldRevision: runtimeContext.snapshot.worldRevision,
    runtimeRevision: runtimeContext.runtimeRevision,
    elevatorRuntime: Object.freeze({
      changed: elevatorRuntime.changed,
      runtimeRevision: elevatorRuntime.runtimeRevision,
      passengerTokens: elevatorRuntime.passengerTokens,
    }),
  })
}

export async function measureBattlemapTokenEntityDistance({
  tokenId,
  entityId,
  database = db,
} = {}) {
  const [initialToken, initialEntity] = await Promise.all([
    database('tokens').where({ id: tokenId }).first(),
    database('entities').where({ id: entityId }).first(),
  ])
  if (!initialToken || !initialEntity) {
    return Object.freeze({ status: 'occupant-not-found', distanceM: null })
  }
  if (initialToken.battlemap_id !== initialEntity.battlemap_id) {
    return Object.freeze({ status: 'cross-battlemap', distanceM: null })
  }
  const elevatorRuntime = await reconcileBattlemapElevators({
    battlemapId: initialToken.battlemap_id,
    database,
  })
  const battlemap = elevatorRuntime.battlemap
  const [token, entity, runtimeContext] = await Promise.all([
    database('tokens').where({ id: tokenId, battlemap_id: battlemap.id }).first(),
    database('entities').where({ id: entityId, battlemap_id: battlemap.id }).first(),
    loadBattlemapRuntimeContext(battlemap, database),
  ])
  if (!token || !entity) return Object.freeze({ status: 'occupant-not-found', distanceM: null })
  if (token.position_space !== 'world-feet') {
    return Object.freeze({ status: 'legacy-position', distanceM: null })
  }
  return Object.freeze({
    status: 'ok',
    distanceM: distanceBetweenWorldPointsM(
      dbPositionToWorldPoint(token),
      dbPositionToWorldPoint(entity),
      runtimeContext.snapshot.metrics,
    ),
    token,
    entity,
    metrics: runtimeContext.snapshot.metrics,
    worldRevision: runtimeContext.snapshot.worldRevision,
    runtimeRevision: runtimeContext.runtimeRevision,
    elevatorRuntime: Object.freeze({
      changed: elevatorRuntime.changed,
      runtimeRevision: elevatorRuntime.runtimeRevision,
      passengerTokens: elevatorRuntime.passengerTokens,
    }),
  })
}
