import { LRUCache } from 'lru-cache'
import { compileSurfaceWorld } from '../../../shared/world/worldCompiler.js'

const MAX_CACHE_ENTRIES = 32

// Compile structurel pur (murs, sols, plafonds, compartiments) — sans état runtime (portes/
// ascenseurs). Clé generation par world_revision uniquement : invalidée à chaque sauvegarde éditeur.
const snapshotCache = new LRUCache({ max: MAX_CACHE_ENTRIES })

function cacheKey(battlemap) {
  return `${battlemap.id}:${Number(battlemap.world_revision || 0)}`
}

export function compileBattlemapWorld(battlemap) {
  return compileSurfaceWorld({
    battlemapId: battlemap.id,
    worldRevision: Number(battlemap.world_revision || 0),
    surfaceData: battlemap.surface_data || {},
  })
}

export function getBattlemapWorldSnapshot(battlemap) {
  const key = cacheKey(battlemap)
  const cached = snapshotCache.get(key)
  if (cached) return cached

  const snapshot = compileBattlemapWorld(battlemap)
  snapshotCache.set(key, snapshot)
  return snapshot
}

export function cacheBattlemapWorldSnapshot(battlemap, snapshot) {
  invalidateBattlemapWorld(battlemap.id)
  snapshotCache.set(cacheKey(battlemap), snapshot)
  return snapshot
}

export function invalidateBattlemapWorld(battlemapId) {
  const prefix = `${battlemapId}:`
  for (const key of snapshotCache.keys()) {
    if (key.startsWith(prefix)) snapshotCache.delete(key)
  }
}

// Compile structurel + état runtime (portes/ascenseurs ouverts/fermés, via world_feature_states).
// Coût dominant de loadBattlemapRuntimeContext (worldEffectService.js) — jamais les définitions ni
// les instances d'effets, qui n'ont pas de compteur de révision par battlemap et doivent rester
// lues à chaque appel pour ne jamais servir une définition/instance périmée.
// Clé génération par world_revision + runtime_revision : cf. audit docs/BUGIDENTIFIE.md DEPLACEMENT1 —
// toute écriture sur world_feature_states bascule runtime_revision dans la même transaction
// (worldEffectService.js:setWorldFeatureState, worldElevatorService.js:persistElevatorState).
const structuralRuntimeSnapshotCache = new LRUCache({ max: MAX_CACHE_ENTRIES })

function structuralRuntimeCacheKey(battlemap) {
  return `${battlemap.id}:${Number(battlemap.world_revision || 0)}:${Number(battlemap.runtime_revision || 0)}`
}

export function getBattlemapStructuralSnapshotWithRuntimeState(battlemap, runtimeState) {
  const key = structuralRuntimeCacheKey(battlemap)
  const cached = structuralRuntimeSnapshotCache.get(key)
  if (cached) return cached

  const snapshot = compileSurfaceWorld({
    battlemapId: battlemap.id,
    worldRevision: Number(battlemap.world_revision || 0),
    surfaceData: battlemap.surface_data || {},
    runtimeState,
  })
  structuralRuntimeSnapshotCache.set(key, snapshot)
  return snapshot
}

export function invalidateBattlemapStructuralRuntimeSnapshot(battlemapId) {
  const prefix = `${battlemapId}:`
  for (const key of structuralRuntimeSnapshotCache.keys()) {
    if (key.startsWith(prefix)) structuralRuntimeSnapshotCache.delete(key)
  }
}
