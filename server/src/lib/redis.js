/**
 * redis.js — Client Redis singleton + helpers collision map
 *
 * Collision map : Redis Hash par battlemap
 *   clé Redis  : "collision:{battlemap_id}"
 *   champ Hash : "x:y:z"  (séparateur ":" — P17, coordonnées base)
 *   valeur     : JSON { type: 'token'|'entity'|'voxel', id: string }
 *
 * TTL : 24h — reconstruite à chaque SESSION_JOIN (PE23)
 * Pipeline Redis : batch des hset au SESSION_JOIN — O(1) réseau au lieu de O(n)
 *
 * Filtres :
 *   - Tokens layer 'gm' exclus (invisibles aux joueurs, non bloquants)
 *   - Entités : incluses uniquement si is_blocking = true dans l'état courant
 *   - Voxels  : tous inclus (geo 'air' non utilisé en V1)
 */

import Redis from 'ioredis'
import db from '../db/knex.js'

// ─── Singleton client Redis ────────────────────────────────────────────────────
// Instancié une seule fois au chargement du module.
// REDIS_URL depuis .env — ex: redis://localhost:6379
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

redis.on('connect', () => console.log('[Redis] Connecté'))
redis.on('error', (err) => console.error('[Redis] Erreur :', err.message))

export default redis

// ─── Clé collision map ─────────────────────────────────────────────────────────
const collisionKey = (battlemapId) => `collision:${battlemapId}`

// ─── buildCollisionMap ─────────────────────────────────────────────────────────
// Reconstruit la collision map complète d'une battlemap depuis PostgreSQL.
// Appelée au SESSION_JOIN — pas au démarrage serveur (PE23).
// Utilise un pipeline Redis pour éviter N aller-retours réseau.
//
// Tokens   : exclus si layer = 'gm'
// Entités  : incluses si is_blocking = true dans l'état courant (JOIN blueprint)
// Voxels   : tous inclus
export async function buildCollisionMap(battlemapId) {
  const key = collisionKey(battlemapId)
  const pipeline = redis.pipeline()

  // Supprimer l'ancienne map avant reconstruction
  pipeline.del(key)

  // ── Tokens ────────────────────────────────────────────────────────────────
  const tokens = await db('tokens').where({ battlemap_id: battlemapId })
  for (const t of tokens) {
    if (t.layer === 'gm') continue   // tokens GM exclus — invisibles aux joueurs
    pipeline.hset(key, `${t.pos_x}:${t.pos_y}:${t.pos_z}`,
      JSON.stringify({ type: 'token', id: t.id }))
  }

  // ── Entités — JOIN blueprint pour lire is_blocking ───────────────────────
  // PE11 : fallback states[0] si current_state_id invalide
  const entities = await db('entities')
    .where({ 'entities.battlemap_id': battlemapId })
    .join('entity_blueprints', 'entities.blueprint_id', 'entity_blueprints.id')
    .select('entities.id', 'entities.pos_x', 'entities.pos_y', 'entities.pos_z',
      'entities.current_state_id', 'entity_blueprints.states')

  for (const e of entities) {
    const states = e.states || []
    const currentState = states[e.current_state_id] ?? states[0] ?? null
    const isBlocking = currentState?.is_blocking ?? true   // défaut bloquant si état inconnu
    if (!isBlocking) continue
    pipeline.hset(key, `${e.pos_x}:${e.pos_y}:${e.pos_z}`,
      JSON.stringify({ type: 'entity', id: e.id }))
  }

  // ── Voxels ────────────────────────────────────────────────────────────────
  const bm = await db('battlemaps').where({ id: battlemapId }).first()
  const voxels = bm?.voxel_data ?? {}
  for (const [voxelKey] of Object.entries(voxels)) {
    // voxelKey = "x:y:z" — séparateur conforme P17
    pipeline.hset(key, voxelKey, JSON.stringify({ type: 'voxel', id: voxelKey }))
  }

  // TTL 24h — reconstruite au prochain SESSION_JOIN
  pipeline.expire(key, 86400)

  await pipeline.exec()
  console.log(`[Redis] Collision map reconstruite — battlemap ${battlemapId}`)
}

// ─── isCaseOccupied ────────────────────────────────────────────────────────────
// Vérifie si une case est occupée dans la collision map Redis.
// O(1) — utilisé dans l'algorithme step-by-step de 9F-B.
//
// excludeIds : liste d'IDs à ignorer — tunnel de swap PE22
//   (tokenId + entityId s'excluent mutuellement pendant le déplacement)
export async function isCaseOccupied(battlemapId, x, y, z, excludeIds = []) {
  const raw = await redis.hget(collisionKey(battlemapId), `${x}:${y}:${z}`)
  if (!raw) return false
  const cell = JSON.parse(raw)
  return !excludeIds.includes(cell.id)
}

// ─── Helpers maintenance token ─────────────────────────────────────────────────

// Ajouter un token à la collision map (création ou fin de déplacement)
// Ignoré si layer = 'gm'
export function collisionAddToken(battlemapId, token) {
  if (token.layer === 'gm') return
  return redis.hset(
    collisionKey(battlemapId),
    `${token.pos_x}:${token.pos_y}:${token.pos_z}`,
    JSON.stringify({ type: 'token', id: token.id })
  )
}

// Retirer un token de la collision map (suppression ou début de déplacement)
export function collisionRemoveToken(battlemapId, token) {
  if (token.layer === 'gm') return
  return redis.hdel(
    collisionKey(battlemapId),
    `${token.pos_x}:${token.pos_y}:${token.pos_z}`
  )
}

// Déplacer un token : hdel ancienne case + hset nouvelle case si pas layer 'gm'
// hdel systématique — même si le layer change (ex: token → gm), on retire l'ancienne case
export async function collisionMoveToken(battlemapId, oldToken, newToken) {
  const pipeline = redis.pipeline()
  // Retirer l'ancienne case si l'ancien token n'était pas GM
  if (oldToken.layer !== 'gm') {
    pipeline.hdel(collisionKey(battlemapId), `${oldToken.pos_x}:${oldToken.pos_y}:${oldToken.pos_z}`)
  }
  // Ajouter la nouvelle case seulement si le nouveau token n'est pas GM
  if (newToken.layer !== 'gm') {
    pipeline.hset(collisionKey(battlemapId), `${newToken.pos_x}:${newToken.pos_y}:${newToken.pos_z}`,
      JSON.stringify({ type: 'token', id: newToken.id }))
  }
  return pipeline.exec()
}

// ─── Helpers maintenance entité ────────────────────────────────────────────────

// Résoudre is_blocking depuis blueprint.states + current_state_id (PE11)
function resolveIsBlocking(blueprint, currentStateId) {
  const states = blueprint.states || []
  const currentState = states[currentStateId] ?? states[0] ?? null
  return currentState?.is_blocking ?? true
}

// Ajouter une entité si is_blocking
export function collisionAddEntity(battlemapId, entity, blueprint) {
  if (!resolveIsBlocking(blueprint, entity.current_state_id)) return
  return redis.hset(
    collisionKey(battlemapId),
    `${entity.pos_x}:${entity.pos_y}:${entity.pos_z}`,
    JSON.stringify({ type: 'entity', id: entity.id })
  )
}

// Retirer une entité de la collision map
export function collisionRemoveEntity(battlemapId, entity) {
  return redis.hdel(
    collisionKey(battlemapId),
    `${entity.pos_x}:${entity.pos_y}:${entity.pos_z}`
  )
}

// Mettre à jour une entité après changement d'état (is_blocking peut changer)
// oldStateId → newStateId : hdel/hset selon is_blocking du nouvel état
export async function collisionUpdateEntityState(battlemapId, entity, blueprint, newStateId) {
  const wasBlocking = resolveIsBlocking(blueprint, entity.current_state_id)
  const isNowBlocking = resolveIsBlocking(blueprint, newStateId)
  const caseKey = `${entity.pos_x}:${entity.pos_y}:${entity.pos_z}`

  if (wasBlocking && !isNowBlocking) {
    return redis.hdel(collisionKey(battlemapId), caseKey)
  }
  if (!wasBlocking && isNowBlocking) {
    return redis.hset(collisionKey(battlemapId), caseKey,
      JSON.stringify({ type: 'entity', id: entity.id }))
  }
  // Pas de changement de blocking → rien à faire
}

// Déplacer une entité : hdel ancienne case + hset nouvelle case si is_blocking
export async function collisionMoveEntity(battlemapId, oldEntity, newEntity, blueprint) {
  const isBlocking = resolveIsBlocking(blueprint, newEntity.current_state_id)
  const pipeline = redis.pipeline()
  pipeline.hdel(collisionKey(battlemapId), `${oldEntity.pos_x}:${oldEntity.pos_y}:${oldEntity.pos_z}`)
  if (isBlocking) {
    pipeline.hset(collisionKey(battlemapId), `${newEntity.pos_x}:${newEntity.pos_y}:${newEntity.pos_z}`,
      JSON.stringify({ type: 'entity', id: newEntity.id }))
  }
  return pipeline.exec()
}

// ─── Helpers maintenance voxel ─────────────────────────────────────────────────

// Ajouter un voxel (x:y:z en coordonnées base — P17)
export function collisionAddVoxel(battlemapId, x, y, z) {
  const caseKey = `${x}:${y}:${z}`
  return redis.hset(
    collisionKey(battlemapId),
    caseKey,
    JSON.stringify({ type: 'voxel', id: caseKey })
  )
}

// Retirer un voxel
export function collisionRemoveVoxel(battlemapId, x, y, z) {
  return redis.hdel(collisionKey(battlemapId), `${x}:${y}:${z}`)
}
