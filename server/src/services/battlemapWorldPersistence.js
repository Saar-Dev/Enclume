import { collectSurfaceTextureIds } from '../../../shared/world/surfaceDocument.js'

export const BATTLEMAP_DOCUMENT_REVISION_COLUMNS = Object.freeze([
  'id',
  'world_revision',
  'surface_revision',
])

function addTextureId(ids, value) {
  if (value == null || value === '') return
  ids.add(value)
}

export function collectBattlemapTextureIds(surfaceData) {
  const ids = new Set()
  for (const textureId of collectSurfaceTextureIds(surfaceData || {})) addTextureId(ids, textureId)
  return Object.freeze([...ids])
}

export async function syncBattlemapTextureUsage(trx, battlemapId, surfaceData) {
  const textureIds = collectBattlemapTextureIds(surfaceData)
  await trx('battlemap_texture_usage').where({ battlemap_id: battlemapId }).delete()
  if (textureIds.length === 0) return textureIds

  await trx('battlemap_texture_usage').insert(textureIds.map(textureId => ({
    battlemap_id: battlemapId,
    surface_texture_id: textureId,
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
