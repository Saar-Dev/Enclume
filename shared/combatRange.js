const RANGE_BANDS = Object.freeze([
  'bout_portant',
  'courte',
  'moyenne',
  'longue',
  'extreme',
])

function numberFromRangeToken(value) {
  const normalized = String(value || '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

export function parseWeaponRangeBands(referenceRange) {
  const raw = String(referenceRange || '').trim()
  if (!raw) return null
  const [main] = raw.split('(')
  const core = main.split('/').map(numberFromRangeToken).filter(Number.isFinite)
  const parenthesized = raw.match(/\(([^)]+)\)/)
  const extreme = parenthesized ? numberFromRangeToken(parenthesized[1]) : null
  let thresholds
  if (core.length >= 4) {
    thresholds = [...core.slice(0, 4), Number.isFinite(extreme) ? extreme : core[3]]
  } else if (core.length === 1) {
    // Une portee unique ne permet pas d'inventer les bandes intermediaires : elle devient une
    // limite extreme, donc le serveur choisit le modificateur le moins favorable.
    thresholds = [0, 0, 0, 0, core[0]]
  } else {
    return null
  }
  for (let index = 1; index < thresholds.length; index++) {
    if (thresholds[index] < thresholds[index - 1]) return null
  }
  return Object.freeze(thresholds)
}

export function resolveWeaponRangeBand(distanceM, referenceRange) {
  const distance = Number(distanceM)
  if (!Number.isFinite(distance) || distance < 0) throw new RangeError('La distance de tir doit etre positive ou nulle')
  const thresholds = parseWeaponRangeBands(referenceRange)
  if (!thresholds) return Object.freeze({ status: 'unsupported-range', band: null, distanceM: distance, thresholds: null })
  const index = thresholds.findIndex(limit => distance <= limit + 1e-9)
  if (index < 0) return Object.freeze({ status: 'out-of-range', band: null, distanceM: distance, thresholds })
  return Object.freeze({ status: 'ok', band: RANGE_BANDS[index], distanceM: distance, thresholds })
}
