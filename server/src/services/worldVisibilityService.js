import db from '../db/knex.js'

import {
  dbPositionToWorldPoint,
  distanceBetweenWorldPointsM,
  worldPointToDbPosition,
} from '../../../shared/world/worldMetrics.js'
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
import { reconcileBattlemapElevators } from './worldElevatorService.js'
import { normalizeEntityScale } from '../../../shared/world/entityTransform.js'
import { queryTokensInShape } from './worldSpatialQueryService.js'

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
    const scale = normalizeEntityScale(entity.state)
    let width = positive(collider.width, positive(geometry.width, 1)) * scale
    let depth = positive(collider.depth, positive(geometry.depth, 1)) * scale
    const height = positive(collider.height, positive(geometry.height, 1)) * scale
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
  // Position hypothétique du token source (forme DB pos_x/pos_y/pos_z) — déclaration ANNONCE non
  // encore confirmée (destination de déplacement déjà posée mais pas résolue). Le token source doit
  // quand même exister et être en 'world-feet' (identité, exclusion interceptors) ; seul le point
  // utilisé pour la géométrie change. Jamais pour targetToken : on ne mesure jamais contre une
  // position hypothétique adverse.
  sourcePositionOverride = null,
} = {}) {
  if (sourceToken?.position_space !== 'world-feet' || targetToken?.position_space !== 'world-feet') {
    return Object.freeze({ status: 'legacy-position', line: null, coverage: null, interceptors: [] })
  }
  const sourceFeet = sourcePositionOverride
    ? dbPositionToWorldPoint(sourcePositionOverride)
    : dbPositionToWorldPoint(sourceToken)
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
    distanceM: distanceBetweenWorldPointsM(sourceFeet, targetFeet, snapshot.metrics),
    line,
    coverage,
    interceptors,
  })
}

/**
 * evaluateAoeVisibility — couche 2+3 composées de la résolution de zone d'effet
 * (docs/PLANS/PLAN_AOE.md §2.1/§2.2). Appelle `queryTokensInShape` UNE fois (réconciliation ascenseur
 * + tokens + entités + runtimeContext), puis `evaluateWorldVisibility` (pur) pour chaque cible retenue
 * par la géométrie, sur ces mêmes données chargées — jamais `evaluateBattlemapVisibility` en boucle,
 * qui rechargerait tout (tokens, entités, ascenseur) à chaque cible.
 *
 * `losSource` (PLAN_AOE.md §6.4) :
 * - 'caster'  — LOS depuis la position réelle du lanceur (armes à trajectoire directe).
 * - 'origin'  — LOS depuis le centre de la zone (explosions/pouvoirs) : réutilise
 *   `sourcePositionOverride` d'evaluateWorldVisibility, prévu à l'origine pour une position
 *   hypothétique de déclaration ANNONCE, mais qui fait exactement ce qu'il faut ici — remplacer le
 *   point géométrique source sans perdre l'identité du token (exclusion des interceptors, profil).
 *   Détournement documenté, pas un nouveau mécanisme.
 */
export async function evaluateAoeVisibility({
  battlemapId,
  aoeShape,
  casterToken,
  losSource = 'caster',
  casterProfile = {},
  targetProfileByTokenId = {},
  database = db,
} = {}) {
  if (losSource !== 'caster' && losSource !== 'origin') {
    throw new RangeError(`losSource inconnu : ${losSource}`)
  }
  // Vérifié une fois, en amont — sans ça, un casterToken en position legacy ferait échouer
  // evaluateWorldVisibility silencieusement pour CHAQUE cible de la boucle (hasLineOfSight: false
  // partout, sans signal clair du pourquoi), au lieu d'un statut net immédiat comme le reste de ce
  // fichier (evaluateBattlemapVisibility, measureBattlemapTokenDistance) le fait déjà pour ce cas.
  if (casterToken?.position_space !== 'world-feet') {
    return Object.freeze({ status: 'legacy-position', losSource, targets: Object.freeze([]) })
  }
  const query = await queryTokensInShape({ battlemapId, aoeShape, database })
  const sourcePositionOverride = losSource === 'origin'
    ? worldPointToDbPosition(aoeShape.origin)
    : null

  const tokensById = new Map(query.tokens.map(token => [token.id, token]))
  const targets = query.targets.map(target => {
    const targetToken = tokensById.get(target.tokenId)
    const visibility = evaluateWorldVisibility({
      snapshot: query.runtimeContext.snapshot,
      sourceToken: casterToken,
      targetToken,
      tokens: query.tokens,
      entities: query.entityRows,
      effectRegions: query.runtimeContext.regions,
      sourceProfile: casterProfile,
      targetProfile: targetProfileByTokenId[target.tokenId] || {},
      sourcePositionOverride,
    })
    return Object.freeze({
      ...target,
      hasLineOfSight: visibility.status === 'clear',
      visibility,
    })
  })

  return Object.freeze({
    status: 'ok',
    losSource,
    targets: Object.freeze(targets),
    // Réexposé (couche 4, PLAN_AOE.md §8 étape 8) — le seul chargement partagé couche 2/3 (§2.2) a déjà
    // ces metrics ; les recharger séparément dans l'appelant violerait l'optimisation "un chargement, N
    // tests" documentée ci-dessus. Nécessaire pour retester un candidat contre un couloir plus étroit
    // (largeur réelle du palier de portée touché) après le filtre géométrique large de queryTokensInShape.
    metrics: query.metrics,
    worldRevision: query.worldRevision,
    runtimeRevision: query.runtimeRevision,
    elevatorRuntime: query.elevatorRuntime,
  })
}

export async function evaluateBattlemapVisibility({
  battlemap,
  sourceToken,
  targetToken,
  sourceProfile = {},
  targetProfile = {},
  sourcePositionOverride = null,
  database = db,
} = {}) {
  const elevatorRuntime = await reconcileBattlemapElevators({
    battlemapId: battlemap.id,
    database,
  })
  const currentBattlemap = elevatorRuntime.battlemap
  const [tokens, entityRows, runtimeContext] = await Promise.all([
    database('tokens').where({ battlemap_id: currentBattlemap.id }),
    database('entities')
      .where({ 'entities.battlemap_id': currentBattlemap.id })
      .join('entity_blueprints', 'entities.blueprint_id', 'entity_blueprints.id')
      .select(
        'entities.id', 'entities.pos_x', 'entities.pos_y', 'entities.pos_z', 'entities.r',
        'entities.current_state_id', 'entities.state', 'entity_blueprints.states', 'entity_blueprints.geometry',
      ),
    loadBattlemapRuntimeContext(currentBattlemap, database),
  ])
  const currentSource = tokens.find(token => token.id === sourceToken.id) || sourceToken
  const currentTarget = tokens.find(token => token.id === targetToken.id) || targetToken
  return Object.freeze({
    ...evaluateWorldVisibility({
      snapshot: runtimeContext?.snapshot || getBattlemapWorldSnapshot(currentBattlemap),
      sourceToken: currentSource,
      targetToken: currentTarget,
      tokens,
      entities: entityRows,
      effectRegions: runtimeContext?.regions || [],
      sourceProfile,
      targetProfile,
      sourcePositionOverride,
    }),
    elevatorRuntime: Object.freeze({
      changed: elevatorRuntime.changed,
      runtimeRevision: elevatorRuntime.runtimeRevision,
      passengerTokens: elevatorRuntime.passengerTokens,
    }),
  })
}
