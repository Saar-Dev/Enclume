// shared/world/worldMetrics.js
// Unités canoniques du moteur de monde. Les règles manipulent des mètres ; les coordonnées de
// rendu et la grille ne sont converties qu'à cette frontière. PE14 reste limité aux adaptateurs DB.

const DEFAULT_METRICS_INPUT = Object.freeze({
  metersPerCell: 1.5,
  worldUnitsPerCell: 1,
  storyHeightWorld: 2.5,
})

function finiteNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new TypeError(`${label} doit être un nombre fini`)
  return number
}

function positiveNumber(value, label) {
  const number = finiteNumber(value, label)
  if (number <= 0) throw new RangeError(`${label} doit être strictement positif`)
  return number
}

function metricsOrDefault(metrics) {
  return metrics ?? DEFAULT_WORLD_METRICS
}

function cleanNumber(value) {
  const rounded = Math.round(value * 1e9) / 1e9
  return Object.is(rounded, -0) ? 0 : rounded
}

export function normalizeWorldPoint(point, label = 'point') {
  if (!point || typeof point !== 'object' || Array.isArray(point)) {
    throw new TypeError(`${label} doit être un objet { x, y, z }`)
  }
  return Object.freeze({
    x: finiteNumber(point.x, `${label}.x`),
    y: finiteNumber(point.y, `${label}.y`),
    z: finiteNumber(point.z, `${label}.z`),
  })
}

export function createWorldMetrics(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('La configuration WorldMetrics doit être un objet')
  }

  const metersPerCell = positiveNumber(
    config.metersPerCell ?? DEFAULT_METRICS_INPUT.metersPerCell,
    'metersPerCell',
  )
  const worldUnitsPerCell = positiveNumber(
    config.worldUnitsPerCell ?? DEFAULT_METRICS_INPUT.worldUnitsPerCell,
    'worldUnitsPerCell',
  )
  const storyHeightWorld = positiveNumber(
    config.storyHeightWorld ?? DEFAULT_METRICS_INPUT.storyHeightWorld,
    'storyHeightWorld',
  )
  const metersPerWorldUnit = metersPerCell / worldUnitsPerCell

  return Object.freeze({
    metersPerCell,
    worldUnitsPerCell,
    storyHeightWorld,
    metersPerWorldUnit,
    storyHeightM: cleanNumber(storyHeightWorld * metersPerWorldUnit),
  })
}

export const DEFAULT_WORLD_METRICS = createWorldMetrics(DEFAULT_METRICS_INPUT)

export function cellsToMeters(cells, metrics) {
  return cleanNumber(finiteNumber(cells, 'cells') * metricsOrDefault(metrics).metersPerCell)
}

export function metersToCells(meters, metrics) {
  return cleanNumber(finiteNumber(meters, 'meters') / metricsOrDefault(metrics).metersPerCell)
}

export function worldUnitsToMeters(worldUnits, metrics) {
  return cleanNumber(
    finiteNumber(worldUnits, 'worldUnits') * metricsOrDefault(metrics).metersPerWorldUnit,
  )
}

export function metersToWorldUnits(meters, metrics) {
  return cleanNumber(
    finiteNumber(meters, 'meters') / metricsOrDefault(metrics).metersPerWorldUnit,
  )
}

export function levelToWorldY(level, metrics) {
  return cleanNumber(finiteNumber(level, 'level') * metricsOrDefault(metrics).storyHeightWorld)
}

export function worldYToLevel(worldY, metrics) {
  return cleanNumber(
    finiteNumber(worldY, 'worldY') / metricsOrDefault(metrics).storyHeightWorld,
  )
}

export function levelToMeters(level, metrics) {
  return cleanNumber(finiteNumber(level, 'level') * metricsOrDefault(metrics).storyHeightM)
}

export function distanceBetweenWorldPointsM(from, to, metrics) {
  const a = normalizeWorldPoint(from, 'from')
  const b = normalizeWorldPoint(to, 'to')
  const distanceWorld = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  return worldUnitsToMeters(distanceWorld, metrics)
}

export function horizontalDistanceBetweenWorldPointsM(from, to, metrics) {
  const a = normalizeWorldPoint(from, 'from')
  const b = normalizeWorldPoint(to, 'to')
  return worldUnitsToMeters(Math.hypot(b.x - a.x, b.z - a.z), metrics)
}

// Distance 3D (même convention que distanceBetweenWorldPointsM, altitude incluse — jamais ignorée :
// un connecteur horizontalement aligné mais à un étage différent ne doit jamais paraître "proche" à
// travers un plancher/plafond) d'un point au segment [segmentStart, segmentEnd] le plus proche. Un
// connecteur porte n'est jamais un point (surfaceDocument.js: x0/x1/z0/z1) — une porte sur mur courbe
// (axis: 'segment') a en plus un arc, approximé ici par sa corde droite (x0,z0)→(x1,z1) à altitude
// constante, jamais par un point d'ancrage qui n'existe pas pour le cas droit (docs/PLANS/
// PLAN_INTERACTIONS_CONNECTEURS.md §2).
export function distanceToSegmentM(point, segmentStart, segmentEnd, metrics) {
  const p = normalizeWorldPoint(point, 'point')
  const a = normalizeWorldPoint(segmentStart, 'segmentStart')
  const b = normalizeWorldPoint(segmentEnd, 'segmentEnd')
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
  const lengthSq = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z
  let t = 0
  if (lengthSq > 0) {
    t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / lengthSq
    t = Math.max(0, Math.min(1, t))
  }
  const closest = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t }
  return distanceBetweenWorldPointsM(p, closest, metrics)
}

export function interpolateWorldPoint(from, to, ratio) {
  const a = normalizeWorldPoint(from, 'from')
  const b = normalizeWorldPoint(to, 'to')
  const t = finiteNumber(ratio, 'ratio')
  if (t < 0 || t > 1) throw new RangeError('ratio doit être compris entre 0 et 1')
  return Object.freeze({
    x: cleanNumber(a.x + (b.x - a.x) * t),
    y: cleanNumber(a.y + (b.y - a.y) * t),
    z: cleanNumber(a.z + (b.z - a.z) * t),
  })
}

// PE14 : DB pos_y = profondeur Z Three.js, DB pos_z = altitude Y Three.js.
export function dbPositionToWorldPoint(position) {
  if (!position || typeof position !== 'object' || Array.isArray(position)) {
    throw new TypeError('position DB doit être un objet pos_x/pos_y/pos_z')
  }
  return normalizeWorldPoint({
    x: position.pos_x,
    y: position.pos_z,
    z: position.pos_y,
  }, 'position DB')
}

export function worldPointToDbPosition(point) {
  const value = normalizeWorldPoint(point)
  return Object.freeze({
    pos_x: value.x,
    pos_y: value.z,
    pos_z: value.y,
  })
}
