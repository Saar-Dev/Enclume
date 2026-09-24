import { randomUUID } from 'node:crypto'
import { LRUCache } from 'lru-cache'

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
import { normalizeEntityScale } from '../../../shared/world/entityTransform.js'

const MAX_GRAPH_CACHE_ENTRIES = 32
const graphCache = new LRUCache({ max: MAX_GRAPH_CACHE_ENTRIES })

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

// Profil d'occupation d'une entité — autorité unique de cette dérivation (forme/dimensions depuis
// blueprint.states[current_state_id]/geometry + échelle d'instance), réutilisée telle quelle par
// dynamicOccupantsFromRows ci-dessous ET par la pose/le déplacement d'entité (entities.js) pour
// tester le candidat lui-même — jamais une seconde formule dupliquée côté route.
// `entity` : forme produite par loadBattlemapDynamicOccupants/executeBattlemapTokenMovement
// (id, pos_x/pos_y/pos_z, r, current_state_id, state [instance transform/scale, PAS is_blocking],
// states [tableau blueprint, PORTE is_blocking], geometry [blueprint]).
// Retourne null si l'état courant n'est pas bloquant (comportement identique à l'exclusion
// silencieuse déjà en place ci-dessous pour le mouvement des tokens).
//
// PLAN_FORME_COLLISION_ENTITES.md — `collider.shape` explicite (`circle`/`rect`) plutôt qu'un
// cercle systématique : un cercle basé sur `max(width,depth)/2` sur-estimait massivement le
// blocage d'un objet allongé (pack de caisses 2,26×1,05 m → rayon 1,13 m calculé, bloquait un
// token à 1 m de son côté étroit). `shape:'circle'` reste la forme correcte pour un objet
// réellement rond (tonneau) — inchangé, comportement historique préservé. Défaut `rect` si
// `collider` absent (tout le catalogue actuel) : plus sûr qu'un cercle pour la quasi-totalité des
// objets (caisses, futur lit/table/chaises/évier/bac).
export function entityOccupant(entity) {
  const state = entityState(entity)
  if ((state?.is_blocking ?? true) === false) return null
  const collider = state?.collider || {}
  const geometry = entity.geometry || {}
  const scale = normalizeEntityScale(entity.state)
  const height = Number(collider.height || geometry.height || 1) * scale
  const feet = dbPositionToWorldPoint(entity)

  if (collider.shape === 'circle') {
    const width = Number(collider.width || geometry.width || 1) * scale
    const depth = Number(collider.depth || geometry.depth || 1) * scale
    return {
      id: entity.id,
      kind: 'entity',
      point: feet,
      actorProfile: {
        shape: 'circle',
        radius: Number(collider.radius ? collider.radius * scale : Math.max(width, depth) / 2),
        height,
        maxStepHeight: 0.5,
      },
    }
  }

  // Rectangle (explicite ou défaut) — largeur/profondeur échangées sur quart de tour impair
  // (entity.r : 0-3, incréments de 90°, PAS la convention 0-7/45° des tokens). Même formule que
  // worldVisibilityService.js#dynamicOccludersFromEntities (quarterTurns), réutilisée telle quelle,
  // pas une deuxième définition.
  let width = Number(collider.width || geometry.width || 1) * scale
  let depth = Number(collider.depth || geometry.depth || 1) * scale
  const quarterTurns = Math.abs(Math.trunc(Number(entity.r) || 0)) % 4
  if (quarterTurns % 2 === 1) [width, depth] = [depth, width]

  // Centre réel du rectangle — `feet` EST le centre si origin='floor-center'/'wall-back-center'
  // (même convention que worldVisibilityService.js, réutilisée), sinon un coin (min), auquel cas
  // le centre est décalé d'une demi-étendue. Sans cette correction le clamp axis-aligned
  // (spatialIndex.js#actorFootprintsOverlap) testerait le mauvais point pour tout blueprint à
  // origine non centrée.
  const origin = collider.origin || geometry.origin
  const centered = origin === 'floor-center' || origin === 'wall-back-center'
  const point = centered ? feet : { x: feet.x + width / 2, y: feet.y, z: feet.z + depth / 2 }

  return {
    id: entity.id,
    kind: 'entity',
    point,
    actorProfile: {
      shape: 'rect',
      halfWidth: width / 2,
      halfDepth: depth / 2,
      height,
      maxStepHeight: 0.5,
    },
  }
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
    const occupant = entityOccupant(entity)
    if (occupant) occupants.push(occupant)
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
        // entities.r — PLAN_FORME_COLLISION_ENTITES.md : sans elle, entityOccupant() ne peut
        // jamais échanger largeur/profondeur pour une entité rectangulaire tournée (retombe
        // silencieusement sur r=0/non tournée pour absolument tout occupant chargé par cette
        // fonction centrale — pathfinding, placement, déplacement de tokens).
        'entities.id', 'entities.pos_x', 'entities.pos_y', 'entities.pos_z', 'entities.r',
          'entities.current_state_id', 'entities.state', 'entity_blueprints.states', 'entity_blueprints.geometry',
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
  // Arrivée « au plus court parmi les nœuds qui vérifient ce prédicat », en alternative à `destination`
  // (planWorldPath, docs/PLANS/PLAN_DRONE_INTERCEPTION.md §3.3-2). Planification pure, n'exécute rien.
  destinationPredicate = null,
  // Le décor (entités) ne compte pas comme occupant : seuls les tokens bloquent une case. Réservé aux
  // acteurs qui se glissent entre les objets (drone d'interposition, décision Saar 2026-09-24).
  ignoreEntityOccupants = false,
} = {}) {
  const elevatorRuntime = await reconcileBattlemapElevators({ battlemapId: battlemap.id })
  const currentBattlemap = elevatorRuntime.battlemap
  const currentToken = await db('tokens')
    .where({ id: token.id, battlemap_id: currentBattlemap.id })
    .first() || token
  const runtimeContext = await loadBattlemapRuntimeContext(currentBattlemap)
  const snapshot = runtimeContext.snapshot
  const graph = getBattlemapNavigationGraph(currentBattlemap, actorProfile, runtimeContext)
  const allOccupants = await loadBattlemapDynamicOccupants(currentBattlemap.id)
  const occupants = ignoreEntityOccupants ? allOccupants.filter(o => o.kind !== 'entity') : allOccupants
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
    destinationPredicate,
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
  ignoreEntityOccupants = false, // voir planBattlemapTokenMovement
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
      ? await trx('entity_blueprints').whereIn('id', blueprintIds).select('id', 'states', 'geometry')
      : []
    const blueprintById = new Map(blueprints.map(blueprint => [blueprint.id, blueprint]))
    const entities = entityRows.map(entity => ({
      ...entity,
      states: blueprintById.get(entity.blueprint_id)?.states || [],
      geometry: blueprintById.get(entity.blueprint_id)?.geometry || {},
    }))

    const runtimeContext = await loadBattlemapRuntimeContext(battlemap, trx)
    const evaluatedRuntimeRevision = runtimeContext.runtimeRevision
    const snapshot = runtimeContext.snapshot
    const graph = getBattlemapNavigationGraph(battlemap, actorProfile, runtimeContext)
    const result = planWorldPath({
      snapshot,
      graph,
      from: dbPositionToWorldPoint(token),
      to: destination,
      budgetM: authorizedBudgetM,
      actorProfile,
      occupants: dynamicOccupantsFromRows(tokens, ignoreEntityOccupants ? [] : entities),
      excludeOccupantIds: [token.id],
      pathId: randomUUID(),
    })
    if (result.status === 'unreachable') {
      return Object.freeze({
        status: 'unreachable', moved: false, result,
        elevatorPassengerTokens: elevatorRuntime.passengerTokens,
        elevatorRuntime: elevatorMeta,
        evaluatedRuntimeRevision,
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
        evaluatedRuntimeRevision,
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
      evaluatedRuntimeRevision,
    })
  })
}
