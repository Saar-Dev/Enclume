import { normalizeSurfaceData } from './surfaceData.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function errorMessage(payload, fallback) {
  if (typeof payload?.error === 'string') return payload.error
  if (typeof payload?.error?.message === 'string') return payload.error.message
  if (typeof payload?.message === 'string') return payload.message
  return fallback
}

async function readResponse(response, fallback) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(errorMessage(payload, fallback))
  return payload
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalize(value[key])]),
  )
}

function normalizedJson(surfaceData) {
  return JSON.stringify(canonicalize(normalizeSurfaceData(surfaceData)))
}

export class SurfaceRevisionConflictError extends Error {
  constructor() {
    super('La carte a été modifiée par un autre éditeur. Tes changements restent ouverts, mais ils ne sont pas sauvegardés.')
    this.name = 'SurfaceRevisionConflictError'
  }
}

export function sameSurfaceDocument(left, right) {
  return normalizedJson(left) === normalizedJson(right)
}

/**
 * Persiste un document Surface avec verrou optimiste.
 *
 * Un 409 peut provenir d'une révision locale devenue obsolète après une réponse interrompue. Dans
 * ce cas seulement, si le document serveur est encore identique à la dernière base connue, la
 * sauvegarde est rebasée sur la nouvelle révision. Une vraie modification concurrente n'est jamais
 * écrasée silencieusement.
 */
export async function persistSurfaceDocument({
  fetchImpl = globalThis.fetch,
  apiBaseUrl = '',
  battlemapId,
  surfaceData,
  expectedRevision,
  baseSurfaceData,
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl doit être une fonction')
  if (!battlemapId) throw new TypeError('battlemapId est obligatoire')

  const surfaceUrl = `${apiBaseUrl}/api/battlemaps/${battlemapId}/surface`
  const battlemapUrl = `${apiBaseUrl}/api/battlemaps/${battlemapId}`
  const normalizedSurfaceData = normalizeSurfaceData(surfaceData)
  const put = revision => fetchImpl(surfaceUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      surface_data: normalizedSurfaceData,
      surface_revision: Number.isFinite(Number(revision)) ? Number(revision) : 0,
    }),
  })

  let response = await put(expectedRevision)
  let remoteBattlemap = null
  if (response.status === 409) {
    const latestResponse = await fetchImpl(battlemapUrl, { credentials: 'include' })
    const latestPayload = await readResponse(latestResponse, `Rechargement carte HTTP ${latestResponse.status}`)
    remoteBattlemap = latestPayload?.battlemap
    if (!remoteBattlemap || !sameSurfaceDocument(baseSurfaceData, remoteBattlemap.surface_data)) {
      throw new SurfaceRevisionConflictError()
    }
    response = await put(remoteBattlemap.surface_revision)
  }

  const data = await readResponse(response, `Sauvegarde surfaces HTTP ${response.status}`)
  if (!Number.isFinite(Number(data.surface_revision)) || !Number.isFinite(Number(data.world_revision))) {
    throw new Error('La réponse de sauvegarde ne contient pas les nouvelles révisions du monde.')
  }
  if (!data.surface_data || typeof data.surface_data !== 'object' || Array.isArray(data.surface_data)) {
    throw new Error('La réponse de sauvegarde ne contient pas le document Surface persisté.')
  }

  return {
    data,
    remoteBattlemap: remoteBattlemap ? clone(remoteBattlemap) : null,
  }
}
