const DEFAULT_STORY_HEIGHT = 2.5
const DEFAULT_OPENING_SIZE = 1
const CIRCLE_SEGMENTS = 48
const LADDER_EDGE_INSET = 0.16

const LADDER_ORIENTATIONS = Object.freeze([
  Object.freeze({ axis: 'x', side: -1 }),
  Object.freeze({ axis: 'z', side: -1 }),
  Object.freeze({ axis: 'x', side: 1 }),
  Object.freeze({ axis: 'z', side: 1 }),
])

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function positive(value, fallback = DEFAULT_OPENING_SIZE) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function normalizeVerticalOpeningShape(value) {
  return value === 'circle' || value === 'round' ? 'circle' : 'rectangle'
}

export function ladderOrientationQuarterTurns(ladder) {
  const axis = ladder?.axis === 'z' ? 'z' : 'x'
  const side = Number(ladder?.side) > 0 ? 1 : -1
  const index = LADDER_ORIENTATIONS.findIndex(orientation => (
    orientation.axis === axis && orientation.side === side
  ))
  return index < 0 ? 0 : index
}

export function rotateLadderOrientation(ladder, deltaQuarterTurns) {
  const current = ladderOrientationQuarterTurns(ladder)
  const next = ((current + Math.trunc(number(deltaQuarterTurns))) % 4 + 4) % 4
  return { ...ladder, ...LADDER_ORIENTATIONS[next], rotationQuarterTurns: next }
}

export function ladderPlacementCenter(ladder, opening = null) {
  const descriptor = opening || verticalAccessOpeningDescriptor(ladder)
  const x = number(descriptor?.x, number(ladder?.x))
  const z = number(descriptor?.z, number(ladder?.z))
  const width = positive(descriptor?.width)
  const depth = positive(descriptor?.depth)
  const alongX = ladder?.axis !== 'z'
  const side = Number(ladder?.side) > 0 ? 1 : -1
  const span = alongX ? depth : width
  const inset = Math.min(span / 2, Math.max(
    LADDER_EDGE_INSET,
    positive(ladder?.depth, 0.12) / 2 + 0.04,
  ))
  return {
    x: alongX ? x + width / 2 : x + (side > 0 ? width - inset : inset),
    z: alongX ? z + (side > 0 ? depth - inset : inset) : z + depth / 2,
  }
}

export function hatchOpeningDescriptor(hatch) {
  if (!hatch) return null
  return {
    shape: normalizeVerticalOpeningShape(hatch.openingShape || hatch.modelGeometry?.openingShape),
    x: number(hatch.x),
    z: number(hatch.z),
    y: number(hatch.y),
    width: positive(hatch.width),
    depth: positive(hatch.depth),
  }
}

export function verticalAccessOpeningDescriptor(ladder, {
  linkedHatch = null,
  storyHeight = DEFAULT_STORY_HEIGHT,
} = {}) {
  if (!ladder || ladder.type !== 'ladder') return null
  const stored = ladder.topOpening
  if (!stored && linkedHatch) return hatchOpeningDescriptor(linkedHatch)
  const topLevel = Math.max(number(ladder.fromLevel), number(ladder.toLevel))
  return {
    shape: normalizeVerticalOpeningShape(stored?.shape || stored?.openingShape),
    x: number(stored?.x, number(ladder.x)),
    z: number(stored?.z, number(ladder.z)),
    y: number(stored?.y, topLevel * positive(storyHeight, DEFAULT_STORY_HEIGHT)),
    width: positive(stored?.width),
    depth: positive(stored?.depth),
  }
}

export function verticalAccessOpenings(surfaceData) {
  const connectors = surfaceData?.connectors || {}
  const hatchesByLadder = new Map(Object.values(connectors)
    .filter(connector => connector?.type === 'hatch' && connector.linkedLadderId)
    .map(connector => [String(connector.linkedLadderId), connector]))
  return Object.entries(connectors).flatMap(([id, connector]) => {
    if (connector?.type !== 'ladder') return []
    const descriptor = verticalAccessOpeningDescriptor(
      { id, ...connector },
      {
        linkedHatch: hatchesByLadder.get(String(id)),
        storyHeight: surfaceData?.storyHeight,
      },
    )
    return descriptor ? [{ ...descriptor, ladderId: id }] : []
  })
}

export function verticalOpeningMultiPolygon(opening, segments = CIRCLE_SEGMENTS) {
  if (!opening) return []
  const x = number(opening.x)
  const z = number(opening.z)
  const width = positive(opening.width)
  const depth = positive(opening.depth)
  if (normalizeVerticalOpeningShape(opening.shape || opening.openingShape) !== 'circle') {
    return [[[
      [x, z],
      [x + width, z],
      [x + width, z + depth],
      [x, z + depth],
      [x, z],
    ]]]
  }
  const safeSegments = Math.max(16, Math.trunc(number(segments, CIRCLE_SEGMENTS)))
  const centerX = x + width / 2
  const centerZ = z + depth / 2
  const contour = Array.from({ length: safeSegments + 1 }, (_, index) => {
    const angle = (index % safeSegments) * Math.PI * 2 / safeSegments
    return [
      centerX + Math.cos(angle) * width / 2,
      centerZ + Math.sin(angle) * depth / 2,
    ]
  })
  return [[contour]]
}

export function verticalAccessOpeningsAtY(surfaceData, y, epsilon = 0.01) {
  return verticalAccessOpenings(surfaceData)
    .filter(opening => Math.abs(number(opening.y) - number(y)) <= epsilon)
}
