// Géométrie canonique des escaliers paramétriques.
// Le renderer, le compilateur physique et l'éditeur doivent tous consommer ces dérivations.

const EPSILON = 1e-9

export const STRAIGHT_STAIR_DEFAULTS = Object.freeze({
  width: 1,
  treadDepth: 0.2,
  maxRiserHeight: 0.12,
  supportThickness: 0.25,
  headClearance: 1.35,
  openingMargin: 0.04,
  railingHeight: 0.72,
  railingThickness: 0.035,
})

export const SPIRAL_STAIR_DEFAULTS = Object.freeze({
  outerRadius: 1.25,
  innerRadius: 0.22,
  totalTurns: 1.25,
  maxRiserHeight: 0.12,
  supportThickness: 0.25,
  treadThickness: 0.055,
  headClearance: 1.35,
  openingMargin: 0.04,
  railingHeight: 0.72,
  railingThickness: 0.035,
  arcSegmentsPerStep: 4,
})

function finite(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function positive(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function clean(value) {
  const rounded = Math.round(Number(value) * 1e9) / 1e9
  return Object.is(rounded, -0) ? 0 : rounded
}

function point(x, y, z) {
  return { x: clean(x), y: clean(y), z: clean(z) }
}

function bounds(minX, minY, minZ, maxX, maxY, maxZ) {
  return {
    min: point(Math.min(minX, maxX), Math.min(minY, maxY), Math.min(minZ, maxZ)),
    max: point(Math.max(minX, maxX), Math.max(minY, maxY), Math.max(minZ, maxZ)),
  }
}

function footprintBounds(start, along, cross, alongMin, alongMax, halfWidth) {
  const corners = [
    [alongMin, -halfWidth],
    [alongMax, -halfWidth],
    [alongMax, halfWidth],
    [alongMin, halfWidth],
  ].map(([distance, side]) => ({
    x: start.x + along.x * distance + cross.x * side,
    z: start.z + along.z * distance + cross.z * side,
  }))
  return {
    minX: clean(Math.min(...corners.map(value => value.x))),
    maxX: clean(Math.max(...corners.map(value => value.x))),
    minZ: clean(Math.min(...corners.map(value => value.z))),
    maxZ: clean(Math.max(...corners.map(value => value.z))),
  }
}

function polygonBounds(polygon, minY, maxY) {
  return bounds(
    Math.min(...polygon.map(value => value.x)),
    minY,
    Math.min(...polygon.map(value => value.z)),
    Math.max(...polygon.map(value => value.x)),
    maxY,
    Math.max(...polygon.map(value => value.z)),
  )
}

function radialPoint(center, radius, angle, y) {
  return point(
    center.x + Math.cos(angle) * radius,
    y,
    center.z + Math.sin(angle) * radius,
  )
}

function annularSectorPolygon(center, innerRadius, outerRadius, startAngle, endAngle, segments) {
  const count = Math.max(1, Number.parseInt(segments, 10) || 1)
  const outer = Array.from({ length: count + 1 }, (_, index) => {
    const angle = startAngle + (endAngle - startAngle) * index / count
    const value = radialPoint(center, outerRadius, angle, 0)
    return { x: value.x, z: value.z }
  })
  const inner = Array.from({ length: count + 1 }, (_, index) => {
    const angle = endAngle - (endAngle - startAngle) * index / count
    const value = radialPoint(center, innerRadius, angle, 0)
    return { x: value.x, z: value.z }
  })
  return [...outer, ...inner]
}

export function straightStairGeometry(stair, { storyHeight = 2.5 } = {}) {
  const axis = stair?.axis === 'z' ? 'z' : 'x'
  const dir = Number(stair?.dir) < 0 ? -1 : 1
  const y = finite(stair?.y, 0)
  const topY = finite(stair?.topY, y + positive(storyHeight, 2.5))
  const rise = Math.max(EPSILON, topY - y)
  const width = positive(stair?.width, STRAIGHT_STAIR_DEFAULTS.width)
  const treadDepth = positive(stair?.treadDepth, STRAIGHT_STAIR_DEFAULTS.treadDepth)
  const requestedStepCount = Number.parseInt(stair?.stepCount, 10)
  const maxRiserHeight = positive(stair?.maxRiserHeight, STRAIGHT_STAIR_DEFAULTS.maxRiserHeight)
  const stepCount = Math.max(1, Number.isInteger(requestedStepCount)
    ? requestedStepCount
    : Math.ceil(rise / maxRiserHeight))
  const riserHeight = rise / stepCount
  const run = treadDepth * stepCount
  const supportThickness = positive(stair?.supportThickness, STRAIGHT_STAIR_DEFAULTS.supportThickness)
  const baseSurfaceY = y + supportThickness / 2
  const topSurfaceY = topY + supportThickness / 2
  const start = {
    x: finite(stair?.x, 0),
    z: finite(stair?.z, 0),
  }
  const along = axis === 'x' ? { x: dir, z: 0 } : { x: 0, z: dir }
  const cross = { x: -along.z, z: along.x }
  const end = {
    x: start.x + along.x * run,
    z: start.z + along.z * run,
  }
  const footprint = footprintBounds(start, along, cross, 0, run, width / 2)

  const steps = Array.from({ length: stepCount }, (_, index) => {
    const alongMin = index * treadDepth
    const alongMax = (index + 1) * treadDepth
    const top = baseSurfaceY + (index + 1) * riserHeight
    const horizontal = footprintBounds(start, along, cross, alongMin, alongMax, width / 2)
    const stepBounds = bounds(
      horizontal.minX,
      baseSurfaceY,
      horizontal.minZ,
      horizontal.maxX,
      top,
      horizontal.maxZ,
    )
    return {
      index,
      bounds: stepBounds,
      position: point(
        (stepBounds.min.x + stepBounds.max.x) / 2,
        (stepBounds.min.y + stepBounds.max.y) / 2,
        (stepBounds.min.z + stepBounds.max.z) / 2,
      ),
      size: [
        clean(stepBounds.max.x - stepBounds.min.x),
        clean(stepBounds.max.y - stepBounds.min.y),
        clean(stepBounds.max.z - stepBounds.min.z),
      ],
      topY: clean(top),
    }
  })

  const anchors = [point(start.x, baseSurfaceY, start.z)]
  for (let index = 0; index < stepCount; index += 1) {
    const distance = (index + 1) * treadDepth
    anchors.push(point(
      start.x + along.x * distance,
      baseSurfaceY + (index + 1) * riserHeight,
      start.z + along.z * distance,
    ))
  }

  const railings = {
    left: stair?.railings?.left !== false,
    right: stair?.railings?.right !== false,
    height: positive(stair?.railings?.height, STRAIGHT_STAIR_DEFAULTS.railingHeight),
    thickness: positive(stair?.railings?.thickness, STRAIGHT_STAIR_DEFAULTS.railingThickness),
  }
  const railParts = []
  for (const side of ['left', 'right']) {
    if (!railings[side]) continue
    const sideSign = side === 'left' ? 1 : -1
    const sideOffset = sideSign * Math.max(0, width / 2 - railings.thickness / 2)
    const railAnchors = anchors.map((anchor, index) => point(
      anchor.x + cross.x * sideOffset,
      anchor.y + railings.height,
      anchor.z + cross.z * sideOffset,
    ))
    for (let index = 0; index < railAnchors.length; index += 1) {
      const top = railAnchors[index]
      const walkingY = anchors[index].y
      railParts.push({
        kind: 'post',
        side,
        index,
        from: point(top.x, walkingY, top.z),
        to: top,
        thickness: railings.thickness,
        bounds: bounds(
          top.x - railings.thickness / 2,
          walkingY,
          top.z - railings.thickness / 2,
          top.x + railings.thickness / 2,
          top.y,
          top.z + railings.thickness / 2,
        ),
      })
      if (index === 0) continue
      const from = railAnchors[index - 1]
      const to = top
      railParts.push({
        kind: 'handrail',
        side,
        index: index - 1,
        from,
        to,
        thickness: railings.thickness,
        bounds: bounds(
          Math.min(from.x, to.x) - railings.thickness / 2,
          Math.min(from.y, to.y) - railings.thickness / 2,
          Math.min(from.z, to.z) - railings.thickness / 2,
          Math.max(from.x, to.x) + railings.thickness / 2,
          Math.max(from.y, to.y) + railings.thickness / 2,
          Math.max(from.z, to.z) + railings.thickness / 2,
        ),
      })
    }
  }

  const headClearance = positive(stair?.headClearance, STRAIGHT_STAIR_DEFAULTS.headClearance)
  const openingMargin = Math.max(0, finite(stair?.openingMargin, STRAIGHT_STAIR_DEFAULTS.openingMargin))
  const upperSlabUnderside = topY - supportThickness / 2
  const openingStartRatio = Math.max(0, Math.min(1,
    (upperSlabUnderside - headClearance - baseSurfaceY) / rise,
  ))
  const openingStart = openingStartRatio * run
  const openingBounds = footprintBounds(
    start,
    along,
    cross,
    openingStart,
    run,
    width / 2 + openingMargin,
  )

  return {
    type: 'straight',
    axis,
    dir,
    y: clean(y),
    topY: clean(topY),
    rise: clean(rise),
    width: clean(width),
    treadDepth: clean(treadDepth),
    stepCount,
    riserHeight: clean(riserHeight),
    run: clean(run),
    supportThickness: clean(supportThickness),
    baseSurfaceY: clean(baseSurfaceY),
    topSurfaceY: clean(topSurfaceY),
    start: point(start.x, baseSurfaceY, start.z),
    end: point(end.x, topSurfaceY, end.z),
    along,
    cross,
    footprint,
    openingBounds,
    steps,
    anchors,
    railings,
    railParts,
  }
}

export function spiralStairGeometry(stair, { storyHeight = 2.5 } = {}) {
  const y = finite(stair?.y, 0)
  const topY = finite(stair?.topY, y + positive(storyHeight, 2.5))
  const rise = Math.max(EPSILON, topY - y)
  const center = {
    x: finite(stair?.x, 0),
    z: finite(stair?.z, 0),
  }
  const outerRadius = positive(stair?.outerRadius, SPIRAL_STAIR_DEFAULTS.outerRadius)
  const innerRadius = Math.min(
    outerRadius - 0.05,
    positive(stair?.innerRadius, SPIRAL_STAIR_DEFAULTS.innerRadius),
  )
  const requestedStepCount = Number.parseInt(stair?.stepCount, 10)
  const maxRiserHeight = positive(stair?.maxRiserHeight, SPIRAL_STAIR_DEFAULTS.maxRiserHeight)
  const stepCount = Math.max(3, Number.isInteger(requestedStepCount)
    ? requestedStepCount
    : Math.ceil(rise / maxRiserHeight))
  const riserHeight = rise / stepCount
  const supportThickness = positive(stair?.supportThickness, SPIRAL_STAIR_DEFAULTS.supportThickness)
  const treadThickness = Math.min(
    riserHeight,
    positive(stair?.treadThickness, SPIRAL_STAIR_DEFAULTS.treadThickness),
  )
  const totalTurns = positive(stair?.totalTurns, SPIRAL_STAIR_DEFAULTS.totalTurns)
  const clockwise = stair?.clockwise === true
  const sweep = Math.PI * 2 * totalTurns * (clockwise ? -1 : 1)
  const rotationQuarterTurns = ((Number.parseInt(stair?.rotationQuarterTurns, 10) || 0) % 4 + 4) % 4
  const startAngle = finite(stair?.startAngle, rotationQuarterTurns * Math.PI / 2)
  const stepAngle = sweep / stepCount
  const baseSurfaceY = y + supportThickness / 2
  const topSurfaceY = topY + supportThickness / 2
  const walkRadius = (innerRadius + outerRadius) / 2
  const arcSegmentsPerStep = Math.max(
    2,
    Number.parseInt(stair?.arcSegmentsPerStep, 10) || SPIRAL_STAIR_DEFAULTS.arcSegmentsPerStep,
  )

  const steps = Array.from({ length: stepCount }, (_, index) => {
    const angleStart = startAngle + index * stepAngle
    const angleEnd = angleStart + stepAngle
    const top = baseSurfaceY + (index + 1) * riserHeight
    const minY = top - treadThickness
    const polygon = annularSectorPolygon(
      center,
      innerRadius,
      outerRadius,
      angleStart,
      angleEnd,
      arcSegmentsPerStep,
    )
    const stepBounds = polygonBounds(polygon, minY, top)
    return {
      index,
      angleStart: clean(angleStart),
      angleEnd: clean(angleEnd),
      polygon,
      minY: clean(minY),
      maxY: clean(top),
      topY: clean(top),
      bounds: stepBounds,
      position: point(
        (stepBounds.min.x + stepBounds.max.x) / 2,
        (stepBounds.min.y + stepBounds.max.y) / 2,
        (stepBounds.min.z + stepBounds.max.z) / 2,
      ),
      size: [
        clean(stepBounds.max.x - stepBounds.min.x),
        clean(stepBounds.max.y - stepBounds.min.y),
        clean(stepBounds.max.z - stepBounds.min.z),
      ],
    }
  })

  const anchors = [radialPoint(center, walkRadius, startAngle, baseSurfaceY)]
  for (let index = 0; index < stepCount; index += 1) {
    anchors.push(radialPoint(
      center,
      walkRadius,
      startAngle + (index + 1) * stepAngle,
      baseSurfaceY + (index + 1) * riserHeight,
    ))
  }

  const railings = {
    outer: stair?.railings?.outer !== false,
    height: positive(stair?.railings?.height, SPIRAL_STAIR_DEFAULTS.railingHeight),
    thickness: positive(stair?.railings?.thickness, SPIRAL_STAIR_DEFAULTS.railingThickness),
  }
  const railParts = []
  if (railings.outer) {
    const railRadius = Math.max(innerRadius, outerRadius - railings.thickness / 2)
    const railAnchors = anchors.map((anchor, index) => radialPoint(
      center,
      railRadius,
      startAngle + index * stepAngle,
      anchor.y + railings.height,
    ))
    for (let index = 0; index < railAnchors.length; index += 1) {
      const top = railAnchors[index]
      const walkingY = anchors[index].y
      railParts.push({
        kind: 'post',
        side: 'outer',
        index,
        from: point(top.x, walkingY, top.z),
        to: top,
        thickness: railings.thickness,
        bounds: bounds(
          top.x - railings.thickness / 2,
          walkingY,
          top.z - railings.thickness / 2,
          top.x + railings.thickness / 2,
          top.y,
          top.z + railings.thickness / 2,
        ),
      })
      if (index === 0) continue
      const from = railAnchors[index - 1]
      const to = top
      railParts.push({
        kind: 'handrail',
        side: 'outer',
        index: index - 1,
        from,
        to,
        thickness: railings.thickness,
        bounds: bounds(
          Math.min(from.x, to.x) - railings.thickness / 2,
          Math.min(from.y, to.y) - railings.thickness / 2,
          Math.min(from.z, to.z) - railings.thickness / 2,
          Math.max(from.x, to.x) + railings.thickness / 2,
          Math.max(from.y, to.y) + railings.thickness / 2,
          Math.max(from.z, to.z) + railings.thickness / 2,
        ),
      })
    }
  }

  const column = {
    center: point(center.x, 0, center.z),
    radius: clean(innerRadius),
    minY: clean(y - supportThickness / 2),
    maxY: clean(topSurfaceY + railings.height),
  }
  column.bounds = bounds(
    center.x - innerRadius,
    column.minY,
    center.z - innerRadius,
    center.x + innerRadius,
    column.maxY,
    center.z + innerRadius,
  )

  const openingMargin = Math.max(0, finite(stair?.openingMargin, SPIRAL_STAIR_DEFAULTS.openingMargin))
  const openingRadius = outerRadius + openingMargin
  const footprint = {
    minX: clean(center.x - outerRadius),
    maxX: clean(center.x + outerRadius),
    minZ: clean(center.z - outerRadius),
    maxZ: clean(center.z + outerRadius),
  }
  const openingBounds = {
    minX: clean(center.x - openingRadius),
    maxX: clean(center.x + openingRadius),
    minZ: clean(center.z - openingRadius),
    maxZ: clean(center.z + openingRadius),
  }

  return {
    type: 'spiral',
    y: clean(y),
    topY: clean(topY),
    rise: clean(rise),
    center: point(center.x, baseSurfaceY, center.z),
    outerRadius: clean(outerRadius),
    innerRadius: clean(innerRadius),
    diameter: clean(outerRadius * 2),
    width: clean(outerRadius - innerRadius),
    totalTurns: clean(totalTurns),
    clockwise,
    rotationQuarterTurns,
    startAngle: clean(startAngle),
    sweep: clean(sweep),
    stepAngle: clean(stepAngle),
    stepCount,
    riserHeight: clean(riserHeight),
    treadDepth: clean(Math.abs(stepAngle) * walkRadius),
    treadThickness: clean(treadThickness),
    supportThickness: clean(supportThickness),
    baseSurfaceY: clean(baseSurfaceY),
    topSurfaceY: clean(topSurfaceY),
    start: anchors[0],
    end: anchors.at(-1),
    footprint,
    openingBounds,
    steps,
    anchors,
    railings,
    railParts,
    column,
  }
}

export function stairGeometry(stair, options) {
  return stair?.kind === 'spiral'
    ? spiralStairGeometry(stair, options)
    : straightStairGeometry(stair, options)
}

export function stairOpeningBounds(stair, options) {
  return stairGeometry(stair, options).openingBounds
}

export function stairOpeningMultiPolygon(stair, options) {
  const opening = stairOpeningBounds(stair, options)
  return [[[
    [opening.minX, opening.minZ],
    [opening.maxX, opening.minZ],
    [opening.maxX, opening.maxZ],
    [opening.minX, opening.maxZ],
    [opening.minX, opening.minZ],
  ]]]
}

export function rectangularSlabFragments(rectangle, openings = []) {
  let fragments = [{
    minX: finite(rectangle?.minX, 0),
    maxX: finite(rectangle?.maxX, 0),
    minZ: finite(rectangle?.minZ, 0),
    maxZ: finite(rectangle?.maxZ, 0),
  }]
  for (const opening of openings) {
    fragments = fragments.flatMap(fragment => {
      const minX = Math.max(fragment.minX, finite(opening?.minX, fragment.maxX))
      const maxX = Math.min(fragment.maxX, finite(opening?.maxX, fragment.minX))
      const minZ = Math.max(fragment.minZ, finite(opening?.minZ, fragment.maxZ))
      const maxZ = Math.min(fragment.maxZ, finite(opening?.maxZ, fragment.minZ))
      if (maxX - minX <= EPSILON || maxZ - minZ <= EPSILON) return [fragment]
      return [
        { minX: fragment.minX, maxX: minX, minZ: fragment.minZ, maxZ: fragment.maxZ },
        { minX: maxX, maxX: fragment.maxX, minZ: fragment.minZ, maxZ: fragment.maxZ },
        { minX, maxX, minZ: fragment.minZ, maxZ: minZ },
        { minX, maxX, minZ: maxZ, maxZ: fragment.maxZ },
      ].filter(value => value.maxX - value.minX > EPSILON && value.maxZ - value.minZ > EPSILON)
    })
  }
  return fragments.map(fragment => ({
    minX: clean(fragment.minX),
    maxX: clean(fragment.maxX),
    minZ: clean(fragment.minZ),
    maxZ: clean(fragment.maxZ),
  }))
}
