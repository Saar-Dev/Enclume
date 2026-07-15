import { collectSurfaceTextureIds } from '../../../shared/world/surfaceDocument.js'

export const BATTLEMAP_DOCUMENT_REVISION_COLUMNS = Object.freeze([
  'id',
  'world_revision',
  'surface_revision',
  'voxel_revision',
])

function addTextureId(ids, value) {
  if (value == null || value === '') return
  ids.add(value)
}

export function collectVoxelTextureIds(voxelData) {
  const ids = new Set()
  for (const voxel of Object.values(voxelData || {})) addTextureId(ids, voxel?.tex)
  return Object.freeze([...ids])
}

export function collectBattlemapTextureIds(voxelData, surfaceData) {
  const ids = new Set(collectVoxelTextureIds(voxelData))
  for (const textureId of collectSurfaceTextureIds(surfaceData || {})) addTextureId(ids, textureId)
  return Object.freeze([...ids])
}

export async function syncBattlemapTextureUsage(trx, battlemapId, voxelData, surfaceData) {
  const textureIds = collectBattlemapTextureIds(voxelData, surfaceData)
  await trx('battlemap_texture_usage').where({ battlemap_id: battlemapId }).delete()
  if (textureIds.length === 0) return textureIds

  await trx('battlemap_texture_usage').insert(textureIds.map(textureId => ({
    battlemap_id: battlemapId,
    voxel_texture_id: textureId,
  })))
  return textureIds
}

export function parseExpectedRevision(value, fieldName) {
  if (value == null) return null
  const revision = Number(value)
  if (!Number.isInteger(revision) || revision < 0) {
    const error = new Error(`${fieldName} must be a non-negative integer`)
    error.statusCode = 400
    throw error
  }
  return revision
}

export function hasRevisionConflict(currentRevision, expectedRevision) {
  return expectedRevision != null && Number(currentRevision) !== expectedRevision
}
