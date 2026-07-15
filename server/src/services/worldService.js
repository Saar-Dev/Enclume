import { compileSurfaceWorld } from '../../../shared/world/worldCompiler.js'

const MAX_CACHE_ENTRIES = 32
const snapshotCache = new Map()

function cacheKey(battlemap) {
  return `${battlemap.id}:${Number(battlemap.world_revision || 0)}`
}

function trimCache() {
  while (snapshotCache.size > MAX_CACHE_ENTRIES) {
    snapshotCache.delete(snapshotCache.keys().next().value)
  }
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
  trimCache()
  return snapshot
}

export function cacheBattlemapWorldSnapshot(battlemap, snapshot) {
  invalidateBattlemapWorld(battlemap.id)
  snapshotCache.set(cacheKey(battlemap), snapshot)
  trimCache()
  return snapshot
}

export function invalidateBattlemapWorld(battlemapId) {
  const prefix = `${battlemapId}:`
  for (const key of snapshotCache.keys()) {
    if (key.startsWith(prefix)) snapshotCache.delete(key)
  }
}
