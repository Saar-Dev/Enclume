import db from '../db/knex.js'
import {
  dbPositionToWorldPoint,
  distanceBetweenWorldPointsM,
  horizontalDistanceBetweenWorldPointsM,
} from '../../../shared/world/worldMetrics.js'
import { pointInsideEffectBounds } from '../../../shared/world/worldEffects.js'
import { isPointInAoeShape } from '../../../shared/world/aoeShapes.js'
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

/**
 * queryTokensInShape — couche 2 de la résolution de zone d'effet (docs/PLANS/PLAN_AOE.md §2.1).
 * Requête EN LOT, pas une boucle d'appels pairwise : charge une seule fois tous les tokens/entités
 * de la battlemap (après réconciliation ascenseur, comme measureBattlemapTokenDistance — une cabine
 * en mouvement ne doit jamais laisser une AOE travailler sur une position périmée), puis filtre en
 * mémoire avec la géométrie pure d'aoeShapes.js.
 *
 * Ne retourne comme cibles que les tokens (entités hors scope fonctionnel v1, PLAN_AOE.md §10) — mais
 * charge aussi les entités et le runtimeContext complet, pour que la couche 3 (LOS, §2.2) réutilise ce
 * même chargement sans requête DB supplémentaire, plutôt que de tout recharger par cible.
 *
 * `battlemapId` invalide (battlemap supprimée) : `reconcileBattlemapElevators` lève une RangeError
 * dure plutôt qu'un statut — comportement volontairement laissé tel quel (fail-fast, cohérent avec
 * `core.md` : le serveur ne doit jamais travailler sur un contexte invalide) ; l'appelant est
 * responsable de ne fournir qu'un battlemapId déjà validé par son propre contexte (campagne/token),
 * jamais une valeur brute non vérifiée venant du client.
 */
export async function queryTokensInShape({
  battlemapId,
  aoeShape,
  database = db,
} = {}) {
  const elevatorRuntime = await reconcileBattlemapElevators({ battlemapId, database })
  const battlemap = elevatorRuntime.battlemap
  const [tokens, entityRows, runtimeContext] = await Promise.all([
    database('tokens').where({ battlemap_id: battlemap.id }),
    database('entities')
      .where({ 'entities.battlemap_id': battlemap.id })
      .join('entity_blueprints', 'entities.blueprint_id', 'entity_blueprints.id')
      .select(
        'entities.id', 'entities.pos_x', 'entities.pos_y', 'entities.pos_z', 'entities.r',
        'entities.current_state_id', 'entities.state', 'entity_blueprints.states', 'entity_blueprints.geometry',
      ),
    loadBattlemapRuntimeContext(battlemap, database),
  ])
  const metrics = runtimeContext.snapshot.metrics

  const targets = []
  for (const token of tokens) {
    // Position legacy (pré-monde-compilé) : hors périmètre spatial, comme les fonctions pairwise
    // ci-dessus — on l'exclut du résultat plutôt que de faire échouer toute la requête pour une seule
    // ligne dépareillée (différence assumée avec le pairwise, qui n'a que 2 tokens et peut se permettre
    // d'échouer net).
    if (token.position_space !== 'world-feet') continue
    // Token MJ (marqueur/preview, jamais un combattant réel) — même exclusion que
    // visibilityActorsFromTokens ci-dessus (ligne ~67) pour les interceptors LOS. Sans ce filtre, un
    // repère MJ invisible aux joueurs deviendrait une cible AOE valide, ce qui n'a aucun sens RAW.
    if (token.layer === 'gm') continue
    const point = dbPositionToWorldPoint(token)
    if (!isPointInAoeShape(point, aoeShape, metrics)) continue
    targets.push(Object.freeze({
      tokenId: token.id,
      distanceToOriginM: horizontalDistanceBetweenWorldPointsM(aoeShape.origin, point, metrics),
      position: point,
    }))
  }

  return Object.freeze({
    status: 'ok',
    targets: Object.freeze(targets),
    tokens,
    entityRows,
    runtimeContext,
    metrics,
    worldRevision: runtimeContext.snapshot.worldRevision,
    runtimeRevision: runtimeContext.runtimeRevision,
    elevatorRuntime: Object.freeze({
      changed: elevatorRuntime.changed,
      runtimeRevision: elevatorRuntime.runtimeRevision,
      passengerTokens: elevatorRuntime.passengerTokens,
    }),
  })
}
