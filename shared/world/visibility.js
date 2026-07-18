// Visibilité 3D pure sur le WorldSnapshot. Les points d'acteur sont des positions de pieds ;
// les rayons anatomiques sont dérivés d'un profil/posture explicite.

import { assertWorldSnapshot } from './worldContracts.js'
import { distanceBetweenWorldPointsM, normalizeWorldPoint } from './worldMetrics.js'
import { normalizeBounds, segmentGeometryInterval } from './spatialIndex.js'

const EPSILON = 1e-7

export const POSTURE_PROFILES = Object.freeze({
  standing: Object.freeze({ height: 1.8, eyeHeight: 1.65, samples: Object.freeze([1.7, 1.3, 0.9, 0.45]) }),
  crouching: Object.freeze({ height: 1.3, eyeHeight: 1.15, samples: Object.freeze([1.2, 0.9, 0.6, 0.3]) }),
  prone: Object.freeze({ height: 0.55, eyeHeight: 0.45, samples: Object.freeze([0.48, 0.36, 0.24, 0.12]) }),
})

const POSTURE_ALIASES = Object.freeze({
  debout: 'standing',
  accroupi: 'crouching',
  crouched: 'crouching',
  couche: 'prone',
  couché: 'prone',
})

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function boundedOpacity(value, label = 'opacity') {
  const opacity = Number(value ?? 1)
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new RangeError(`${label} doit être compris entre 0 et 1`)
  }
  return opacity
}

export function normalizePosture(value = 'standing') {
  const key = String(value || 'standing').trim().toLowerCase()
  const posture = POSTURE_ALIASES[key] || key
  if (!POSTURE_PROFILES[posture]) throw new RangeError(`posture inconnue : ${value}`)
  return posture
}

export function normalizeVisibilityProfile(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('visibilityProfile doit être un objet')
  }
  const posture = normalizePosture(input.posture)
  const defaults = POSTURE_PROFILES[posture]
  const height = Number(input.height ?? defaults.height)
  const eyeHeight = Number(input.eyeHeight ?? Math.min(defaults.eyeHeight, height))
  const radius = Number(input.radius ?? 0.35)
  const samples = (input.samples ?? defaults.samples).map(Number)
  if (!Number.isFinite(height) || height <= 0) throw new RangeError('profile.height invalide')
  if (!Number.isFinite(eyeHeight) || eyeHeight <= 0 || eyeHeight > height) {
    throw new RangeError('profile.eyeHeight invalide')
  }
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('profile.radius invalide')
  if (!samples.length || samples.some(value => !Number.isFinite(value) || value <= 0 || value > height)) {
    throw new RangeError('profile.samples invalide')
  }
  return deepFreeze({ posture, height, eyeHeight, radius, samples })
}

export function actorEyePoint(feet, profile = {}) {
  const point = normalizeWorldPoint(feet, 'feet')
  const normalized = normalizeVisibilityProfile(profile)
  return deepFreeze({ x: point.x, y: point.y + normalized.eyeHeight, z: point.z })
}

function segmentBoundsInterval(from, to, value) {
  const bounds = normalizeBounds(value)
  let near = 0
  let far = 1
  for (const axis of ['x', 'y', 'z']) {
    const delta = to[axis] - from[axis]
    if (Math.abs(delta) <= EPSILON) {
      if (from[axis] < bounds.min[axis] || from[axis] > bounds.max[axis]) return null
      continue
    }
    let axisNear = (bounds.min[axis] - from[axis]) / delta
    let axisFar = (bounds.max[axis] - from[axis]) / delta
    if (axisNear > axisFar) [axisNear, axisFar] = [axisFar, axisNear]
    near = Math.max(near, axisNear)
    far = Math.min(far, axisFar)
    if (near > far) return null
  }
  if (far <= EPSILON || near >= 1 - EPSILON) return null
  return { near: Math.max(EPSILON, near), far: Math.min(1 - EPSILON, far) }
}

export function normalizeOccluder(input, index = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`occluders[${index}] doit être un objet`)
  }
  if (typeof input.id !== 'string' || !input.id.trim()) {
    throw new TypeError(`occluders[${index}].id doit être une chaîne non vide`)
  }
  return deepFreeze({
    ...input,
    id: input.id,
    bounds: normalizeBounds(input.bounds, `occluders[${index}].bounds`),
    opacity: boundedOpacity(input.opacity, `occluders[${index}].opacity`),
  })
}

export function traceVisibility({
  snapshot,
  from,
  to,
  dynamicOccluders = [],
  excludeOccluderIds = [],
  blockingTransmittance = 0.05,
} = {}) {
  assertWorldSnapshot(snapshot)
  const start = normalizeWorldPoint(from, 'from')
  const end = normalizeWorldPoint(to, 'to')
  const threshold = Number(blockingTransmittance)
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new RangeError('blockingTransmittance doit être compris entre 0 et 1')
  }
  const excluded = new Set(excludeOccluderIds)
  const occluders = [
    ...snapshot.spatial.occluders.map(normalizeOccluder),
    ...dynamicOccluders.map((item, index) => normalizeOccluder(item, snapshot.spatial.occluders.length + index)),
  ]
  const intersections = []
  for (const occluder of occluders) {
    if (excluded.has(occluder.id) || occluder.opacity <= EPSILON) continue
    const rawInterval = ['wall-segment', 'wall-arc', 'horizontal-prism', 'vertical-cylinder'].includes(occluder.geometry?.type)
      ? segmentGeometryInterval(start, end, occluder.geometry)
      : segmentBoundsInterval(start, end, occluder.bounds)
    const interval = rawInterval && rawInterval.far > EPSILON && rawInterval.near < 1 - EPSILON
      ? { near: Math.max(EPSILON, rawInterval.near), far: Math.min(1 - EPSILON, rawInterval.far) }
      : null
    if (interval) intersections.push({ occluder, ...interval })
  }
  intersections.sort((a, b) => a.near - b.near || a.occluder.id.localeCompare(b.occluder.id))

  let transmittance = 1
  const blockers = []
  for (const intersection of intersections) {
    transmittance *= 1 - intersection.occluder.opacity
    blockers.push({
      id: intersection.occluder.id,
      sourceId: intersection.occluder.sourceId ?? null,
      kind: intersection.occluder.kind || 'occluder',
      opacity: intersection.occluder.opacity,
      near: intersection.near,
      far: intersection.far,
    })
    if (transmittance <= threshold + EPSILON) break
  }
  return deepFreeze({
    from: start,
    to: end,
    clear: transmittance > threshold + EPSILON,
    transmittance: Math.max(0, Math.round(transmittance * 1e9) / 1e9),
    distanceM: distanceBetweenWorldPointsM(start, end, snapshot.metrics),
    blockers,
  })
}

export function checkWorldLineOfSight({
  snapshot,
  sourceFeet,
  targetFeet,
  sourceProfile = {},
  targetProfile = {},
  dynamicOccluders = [],
  excludeOccluderIds = [],
} = {}) {
  const from = actorEyePoint(sourceFeet, sourceProfile)
  const to = actorEyePoint(targetFeet, targetProfile)
  return traceVisibility({ snapshot, from, to, dynamicOccluders, excludeOccluderIds })
}

export function checkWorldCoverage({
  snapshot,
  sourceFeet,
  targetFeet,
  sourceProfile = {},
  targetProfile = {},
  dynamicOccluders = [],
  excludeOccluderIds = [],
} = {}) {
  const source = normalizeWorldPoint(sourceFeet, 'sourceFeet')
  const target = normalizeWorldPoint(targetFeet, 'targetFeet')
  const sourceActor = normalizeVisibilityProfile(sourceProfile)
  const targetActor = normalizeVisibilityProfile(targetProfile)
  const from = actorEyePoint(source, sourceActor)
  const rays = targetActor.samples.map((height, index) => traceVisibility({
    snapshot,
    from,
    to: { x: target.x, y: target.y + height, z: target.z },
    dynamicOccluders,
    excludeOccluderIds,
  })).map((ray, index) => deepFreeze({ sample: index, height: targetActor.samples[index], ...ray }))
  const blocked = rays.filter(ray => !ray.clear).length
  const ratio = blocked / rays.length
  return deepFreeze({
    blocked,
    total: rays.length,
    ratio,
    modifier: ratio >= 0.75 ? -5 : ratio >= 0.5 ? -3 : 0,
    rays,
  })
}

export function findWorldInterceptors({
  snapshot,
  from,
  to,
  actors = [],
  excludeActorIds = [],
} = {}) {
  assertWorldSnapshot(snapshot)
  const start = normalizeWorldPoint(from, 'from')
  const end = normalizeWorldPoint(to, 'to')
  const excluded = new Set(excludeActorIds)
  const delta = { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z }
  const lengthWorld = Math.hypot(delta.x, delta.y, delta.z)
  if (lengthWorld <= EPSILON) return Object.freeze([])
  const direction = { x: delta.x / lengthWorld, y: delta.y / lengthWorld, z: delta.z / lengthWorld }
  const hits = []
  for (const actor of actors) {
    if (!actor?.id || excluded.has(actor.id)) continue
    const feet = normalizeWorldPoint(actor.point ?? actor.feet, `actor:${actor.id}`)
    const profile = normalizeVisibilityProfile(actor.profile || {})
    const center = { x: feet.x, y: feet.y + profile.height / 2, z: feet.z }
    const relative = { x: center.x - start.x, y: center.y - start.y, z: center.z - start.z }
    const along = relative.x * direction.x + relative.y * direction.y + relative.z * direction.z
    if (along <= profile.radius || along >= lengthWorld - profile.radius) continue
    const closest = {
      x: start.x + direction.x * along,
      y: start.y + direction.y * along,
      z: start.z + direction.z * along,
    }
    const horizontal = Math.hypot(center.x - closest.x, center.z - closest.z)
    const vertical = Math.abs(center.y - closest.y)
    if (horizontal <= profile.radius && vertical <= profile.height / 2) {
      hits.push({ actorId: actor.id, distanceM: distanceBetweenWorldPointsM(start, closest, snapshot.metrics) })
    }
  }
  hits.sort((a, b) => a.distanceM - b.distanceM || a.actorId.localeCompare(b.actorId))
  return deepFreeze(hits)
}
