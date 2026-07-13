// Index spatial commun au mouvement, aux collisions et à la visibilité. La géométrie statique du
// snapshot et l'occupation dynamique restent deux index distincts.

import { assertWorldSnapshot } from './worldContracts.js'
import { normalizeWorldPoint } from './worldMetrics.js'

const EPSILON = 1e-9

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

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

export function normalizeBounds(value, label = 'bounds') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} doit être un objet min/max`)
  }
  const min = normalizeWorldPoint(value.min, `${label}.min`)
  const max = normalizeWorldPoint(value.max, `${label}.max`)
  if (min.x > max.x || min.y > max.y || min.z > max.z) {
    throw new RangeError(`${label}.min doit être inférieur ou égal à ${label}.max`)
  }
  return deepFreeze({ min, max })
}

export function boundsIntersect(left, right, epsilon = EPSILON) {
  const a = normalizeBounds(left, 'left')
  const b = normalizeBounds(right, 'right')
  return a.max.x > b.min.x + epsilon && a.min.x < b.max.x - epsilon
    && a.max.y > b.min.y + epsilon && a.min.y < b.max.y - epsilon
    && a.max.z > b.min.z + epsilon && a.min.z < b.max.z - epsilon
}

export function pointInBounds(point, value, epsilon = EPSILON) {
  const p = normalizeWorldPoint(point)
  const bounds = normalizeBounds(value)
  return p.x >= bounds.min.x - epsilon && p.x <= bounds.max.x + epsilon
    && p.y >= bounds.min.y - epsilon && p.y <= bounds.max.y + epsilon
    && p.z >= bounds.min.z - epsilon && p.z <= bounds.max.z + epsilon
}

export function normalizeActorProfile(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('actorProfile doit être un objet')
  }
  return deepFreeze({
    radius: positiveNumber(input.radius ?? 0.35, 'actorProfile.radius'),
    height: positiveNumber(input.height ?? 1.8, 'actorProfile.height'),
    maxStepHeight: positiveNumber(input.maxStepHeight ?? 0.5, 'actorProfile.maxStepHeight'),
  })
}

export function actorBoundsAt(point, actorProfile = {}) {
  const feet = normalizeWorldPoint(point, 'actor feet')
  const actor = normalizeActorProfile(actorProfile)
  return deepFreeze({
    min: { x: feet.x - actor.radius, y: feet.y, z: feet.z - actor.radius },
    max: { x: feet.x + actor.radius, y: feet.y + actor.height, z: feet.z + actor.radius },
  })
}

export function segmentIntersectsBounds(from, to, value) {
  const start = normalizeWorldPoint(from, 'segment.from')
  const end = normalizeWorldPoint(to, 'segment.to')
  const bounds = normalizeBounds(value)
  let near = 0
  let far = 1

  for (const axis of ['x', 'y', 'z']) {
    const delta = end[axis] - start[axis]
    if (Math.abs(delta) <= EPSILON) {
      if (start[axis] < bounds.min[axis] || start[axis] > bounds.max[axis]) return false
      continue
    }
    const inverse = 1 / delta
    let axisNear = (bounds.min[axis] - start[axis]) * inverse
    let axisFar = (bounds.max[axis] - start[axis]) * inverse
    if (axisNear > axisFar) [axisNear, axisFar] = [axisFar, axisNear]
    near = Math.max(near, axisNear)
    far = Math.min(far, axisFar)
    if (near > far) return false
  }
  return far >= 0 && near <= 1
}

function wallSegmentGeometryInterval(from, to, geometry, {
  horizontalPadding = 0,
  verticalBottomPadding = 0,
  verticalTopInset = 0,
} = {}) {
  if (geometry?.type !== 'wall-segment') return null
  const start = normalizeWorldPoint(from, 'segment.from')
  const end = normalizeWorldPoint(to, 'segment.to')
  const wallFromX = finiteNumber(geometry.from?.x, 'geometry.from.x')
  const wallFromZ = finiteNumber(geometry.from?.z, 'geometry.from.z')
  const wallToX = finiteNumber(geometry.to?.x, 'geometry.to.x')
  const wallToZ = finiteNumber(geometry.to?.z, 'geometry.to.z')
  const dx = wallToX - wallFromX
  const dz = wallToZ - wallFromZ
  const length = Math.hypot(dx, dz)
  if (length <= EPSILON) return null
  const alongX = dx / length
  const alongZ = dz / length
  const normalX = -alongZ
  const normalZ = alongX
  const half = positiveNumber(geometry.thickness, 'geometry.thickness') / 2 + horizontalPadding
  const ranges = [
    {
      start: (start.x - wallFromX) * alongX + (start.z - wallFromZ) * alongZ,
      end: (end.x - wallFromX) * alongX + (end.z - wallFromZ) * alongZ,
      min: -horizontalPadding,
      max: length + horizontalPadding,
    },
    {
      start: (start.x - wallFromX) * normalX + (start.z - wallFromZ) * normalZ,
      end: (end.x - wallFromX) * normalX + (end.z - wallFromZ) * normalZ,
      min: -half,
      max: half,
    },
    {
      start: start.y,
      end: end.y,
      min: finiteNumber(geometry.minY, 'geometry.minY') - verticalBottomPadding,
      max: finiteNumber(geometry.maxY, 'geometry.maxY') - verticalTopInset,
    },
  ]
  let near = 0
  let far = 1
  for (const range of ranges) {
    const delta = range.end - range.start
    if (Math.abs(delta) <= EPSILON) {
      if (range.start < range.min || range.start > range.max) return null
      continue
    }
    let axisNear = (range.min - range.start) / delta
    let axisFar = (range.max - range.start) / delta
    if (axisNear > axisFar) [axisNear, axisFar] = [axisFar, axisNear]
    near = Math.max(near, axisNear)
    far = Math.min(far, axisFar)
    if (near > far) return null
  }
  return far >= 0 && near <= 1 ? { near: Math.max(0, near), far: Math.min(1, far) } : null
}

export function segmentGeometryInterval(from, to, geometry, options = {}) {
  return wallSegmentGeometryInterval(from, to, geometry, options)
}

function bucketRange(bounds, bucketSize) {
  const range = {}
  for (const axis of ['x', 'y', 'z']) {
    range[axis] = [
      Math.floor(bounds.min[axis] / bucketSize),
      Math.floor((bounds.max[axis] - EPSILON) / bucketSize),
    ]
  }
  return range
}

function bucketKeys(bounds, bucketSize) {
  const range = bucketRange(bounds, bucketSize)
  const keys = []
  for (let x = range.x[0]; x <= range.x[1]; x++) {
    for (let y = range.y[0]; y <= range.y[1]; y++) {
      for (let z = range.z[0]; z <= range.z[1]; z++) keys.push(`${x}:${y}:${z}`)
    }
  }
  return keys
}

function createBoundsIndex(items, { bucketSize = 2 } = {}) {
  const size = positiveNumber(bucketSize, 'bucketSize')
  const normalized = items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError(`items[${index}] doit être un objet`)
    }
    if (typeof item.id !== 'string' || !item.id.trim()) {
      throw new TypeError(`items[${index}].id doit être une chaîne non vide`)
    }
    return deepFreeze({ ...item, bounds: normalizeBounds(item.bounds, `items[${index}].bounds`) })
  })
  const buckets = new Map()
  for (const item of normalized) {
    for (const key of bucketKeys(item.bounds, size)) {
      const bucket = buckets.get(key) || []
      bucket.push(item)
      buckets.set(key, bucket)
    }
  }

  const queryBounds = value => {
    const bounds = normalizeBounds(value)
    const candidates = new Map()
    for (const key of bucketKeys(bounds, size)) {
      for (const item of buckets.get(key) || []) candidates.set(item.id, item)
    }
    return Object.freeze([...candidates.values()].filter(item => boundsIntersect(bounds, item.bounds)))
  }

  return Object.freeze({ items: Object.freeze(normalized), queryBounds })
}

export function createSpatialIndex(snapshot, options = {}) {
  assertWorldSnapshot(snapshot)
  const colliderIndex = createBoundsIndex(snapshot.spatial.colliders, options)
  const supportIndex = createBoundsIndex(snapshot.spatial.supports, options)

  const segmentBlockers = (from, to, actorProfile = {}) => {
    const start = normalizeWorldPoint(from, 'from')
    const end = normalizeWorldPoint(to, 'to')
    const actor = normalizeActorProfile(actorProfile)
    const sweptBounds = {
      min: {
        x: Math.min(start.x, end.x) - actor.radius,
        y: Math.min(start.y, end.y),
        z: Math.min(start.z, end.z) - actor.radius,
      },
      max: {
        x: Math.max(start.x, end.x) + actor.radius,
        y: Math.max(start.y, end.y) + actor.height,
        z: Math.max(start.z, end.z) + actor.radius,
      },
    }
    return Object.freeze(colliderIndex.queryBounds(sweptBounds).filter(collider => {
      // Le support touché par les pieds n'est pas un obstacle ; un mur qui monte au-dessus l'est.
      if (collider.bounds.max.y <= Math.min(start.y, end.y) + EPSILON) return false
      const expanded = {
        min: {
          x: collider.bounds.min.x - actor.radius,
          y: collider.bounds.min.y - actor.height + EPSILON,
          z: collider.bounds.min.z - actor.radius,
        },
        max: {
          x: collider.bounds.max.x + actor.radius,
          y: collider.bounds.max.y - EPSILON,
          z: collider.bounds.max.z + actor.radius,
        },
      }
      if (collider.geometry?.type === 'wall-segment') {
        return !!segmentGeometryInterval(start, end, collider.geometry, {
          horizontalPadding: actor.radius,
          verticalBottomPadding: actor.height - EPSILON,
          verticalTopInset: EPSILON,
        })
      }
      return segmentIntersectsBounds(start, end, expanded)
    }))
  }

  return Object.freeze({
    snapshot,
    colliders: colliderIndex.items,
    supports: supportIndex.items,
    queryColliders: colliderIndex.queryBounds,
    querySupports: supportIndex.queryBounds,
    segmentBlockers,
    isSegmentClear: (from, to, actorProfile) => segmentBlockers(from, to, actorProfile).length === 0,
  })
}

export function normalizeOccupant(input, index = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`occupants[${index}] doit être un objet`)
  }
  if (typeof input.id !== 'string' || !input.id.trim()) {
    throw new TypeError(`occupants[${index}].id doit être une chaîne non vide`)
  }
  const bounds = input.bounds
    ? normalizeBounds(input.bounds, `occupants[${index}].bounds`)
    : actorBoundsAt(input.point ?? input.position, input.actorProfile)
  return deepFreeze({ ...input, id: input.id, kind: input.kind || 'occupant', bounds })
}

export function createOccupancyIndex(occupants = [], options = {}) {
  if (!Array.isArray(occupants)) throw new TypeError('occupants doit être un tableau')
  const normalized = occupants.map(normalizeOccupant)
  const index = createBoundsIndex(normalized, options)

  const queryBounds = (bounds, { excludeIds = [] } = {}) => {
    const excluded = new Set(excludeIds)
    return Object.freeze(index.queryBounds(bounds).filter(item => !excluded.has(item.id)))
  }
  const canOccupy = (point, actorProfile = {}, queryOptions = {}) => (
    queryBounds(actorBoundsAt(point, actorProfile), queryOptions).length === 0
  )

  return Object.freeze({
    occupants: index.items,
    queryBounds,
    canOccupy,
  })
}
