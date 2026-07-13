import db from '../db/knex.js'

import { dbPositionToWorldPoint } from '../../../shared/world/worldMetrics.js'
import {
  actorEyePoint,
  checkWorldCoverage,
  checkWorldLineOfSight,
  findWorldInterceptors,
  normalizeVisibilityProfile,
} from '../../../shared/world/visibility.js'
import { getBattlemapWorldSnapshot } from './worldService.js'
import { effectOccludersFromRegions } from '../../../shared/world/worldEffects.js'
import { loadBattlemapRuntimeContext } from './worldEffectService.js'

function stateAt(entity) {
  return entity.states?.[entity.current_state_id] ?? entity.states?.[0] ?? null
}

function positive(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export function dynamicOccludersFromEntities(entities = []) {
  const occluders = []
  for (const entity of entities) {
    const state = stateAt(entity)
    if ((state?.blocks_sight ?? state?.blocksSight ?? state?.is_blocking ?? true) === false) continue
    const collider = state?.occluder || state?.collider || {}
    const geometry = entity.geometry || {}
    let width = positive(collider.width, positive(geometry.width, 1))
    let depth = positive(collider.depth, positive(geometry.depth, 1))
    const height = positive(collider.height, positive(geometry.height, 1))
    const quarterTurns = Math.abs(Math.trunc(Number(entity.r) || 0)) % 4
    if (quarterTurns % 2 === 1) [width, depth] = [depth, width]
    const feet = dbPositionToWorldPoint(entity)
    const centered = (collider.origin || geometry.origin) === 'floor-center'
      || (collider.origin || geometry.origin) === 'wall-back-center'
    const offset = collider.offset || {}
    const minX = feet.x + Number(offset.x || 0) - (centered ? width / 2 : 0)
    const minY = feet.y + Number(offset.y || 0)
    const minZ = feet.z + Number(offset.z || 0) - (centered ? depth / 2 : 0)
    occluders.push({
      id: `entity:${entity.id}`,
      sourceId: entity.id,
      kind: 'entity',
      opacity: Number(state?.sight_opacity ?? state?.sightOpacity ?? 1),
      bounds: {
        min: { x: minX, y: minY, z: minZ },
        max: { x: minX + width, y: minY + height, z: minZ + depth },
      },
    })
  }
  return Object.freeze(occluders)
}

export function visibilityActorsFromTokens(tokens = [], profileByTokenId = {}) {
  return Object.freeze(tokens
    .filter(token => token.position_space === 'world-feet' && token.layer !== 'gm')
    .map(token => ({
      id: token.id,
      point: dbPositionToWorldPoint(token),
      profile: normalizeVisibilityProfile(profileByTokenId[token.id] || {}),
    })))
}

export function evaluateWorldVisibility({
  snapshot,
  sourceToken,
  targetToken,
  tokens = [],
  entities = [],
  sourceProfile = {},
  targetProfile = {},
  profileByTokenId = {},
  effectRegions = [],
} = {}) {
  if (sourceToken?.position_space !== 'world-feet' || targetToken?.position_space !== 'world-feet') {
    return Object.freeze({ status: 'legacy-position', line: null, coverage: null, interceptors: [] })
  }
  const sourceFeet = dbPositionToWorldPoint(sourceToken)
  const targetFeet = dbPositionToWorldPoint(targetToken)
  const normalizedSource = normalizeVisibilityProfile(sourceProfile)
  const normalizedTarget = normalizeVisibilityProfile(targetProfile)
  const dynamicOccluders = Object.freeze([
    ...dynamicOccludersFromEntities(entities),
    ...effectOccludersFromRegions(effectRegions),
  ])
  const line = checkWorldLineOfSight({
    snapshot,
    sourceFeet,
    targetFeet,
    sourceProfile: normalizedSource,
    targetProfile: normalizedTarget,
    dynamicOccluders,
  })
  const coverage = checkWorldCoverage({
    snapshot,
    sourceFeet,
    targetFeet,
    sourceProfile: normalizedSource,
    targetProfile: normalizedTarget,
    dynamicOccluders,
  })
  const interceptors = findWorldInterceptors({
    snapshot,
    from: actorEyePoint(sourceFeet, normalizedSource),
    to: actorEyePoint(targetFeet, normalizedTarget),
    actors: visibilityActorsFromTokens(tokens, profileByTokenId),
    excludeActorIds: [sourceToken.id, targetToken.id],
  })
  return Object.freeze({
    status: line.clear ? 'clear' : 'blocked',
    worldRevision: snapshot.worldRevision,
    line,
    coverage,
    interceptors,
  })
}

export async function evaluateBattlemapVisibility({
  battlemap,
  sourceToken,
  targetToken,
  sourceProfile = {},
  targetProfile = {},
  database = db,
} = {}) {
  const [tokens, entityRows, runtimeContext] = await Promise.all([
    database('tokens').where({ battlemap_id: battlemap.id }),
    database('entities')
      .where({ 'entities.battlemap_id': battlemap.id })
      .join('entity_blueprints', 'entities.blueprint_id', 'entity_blueprints.id')
      .select(
        'entities.id', 'entities.pos_x', 'entities.pos_y', 'entities.pos_z', 'entities.r',
        'entities.current_state_id', 'entity_blueprints.states', 'entity_blueprints.geometry',
      ),
    loadBattlemapRuntimeContext(battlemap, database),
  ])
  return evaluateWorldVisibility({
    snapshot: runtimeContext?.snapshot || getBattlemapWorldSnapshot(battlemap),
    sourceToken,
    targetToken,
    tokens,
    entities: entityRows,
    effectRegions: runtimeContext?.regions || [],
    sourceProfile,
    targetProfile,
  })
}
