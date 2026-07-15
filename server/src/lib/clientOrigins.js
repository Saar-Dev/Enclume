function normalizeOrigin(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`Origine client invalide : ${raw}`)
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Protocole d'origine client non autorisé : ${parsed.protocol}`)
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error(`Une origine client ne doit contenir que protocole, hôte et port : ${raw}`)
  }
  return parsed.origin
}

export function parseClientOrigins(value) {
  const origins = String(value || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean)

  const uniqueOrigins = [...new Set(origins)]
  if (uniqueOrigins.length === 0) {
    throw new Error('CLIENT_URLS ou CLIENT_URL doit définir au moins une origine client')
  }
  return uniqueOrigins
}

export function createCorsOriginValidator(origins) {
  const allowedOrigins = new Set(origins)
  return (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }
    callback(null, false)
  }
}
