import polygonClipping from 'polygon-clipping'

const EPSILON = 1e-7

function clean(value) {
  const rounded = Math.round(Number(value) * 1e6) / 1e6
  return Object.is(rounded, -0) ? 0 : rounded
}

function point(x, z) {
  return { x: clean(x), z: clean(z) }
}

function samePoint(left, right) {
  return Math.abs(Number(left?.x) - Number(right?.x)) <= EPSILON
    && Math.abs(Number(left?.z) - Number(right?.z)) <= EPSILON
}

function vertexKey(value) {
  return `${clean(value.x)}:${clean(value.z)}`
}

export function roomCellKey(x, z) {
  return `${Math.trunc(Number(x) || 0)}:${Math.trunc(Number(z) || 0)}`
}

export function roomGeometryCells(room) {
  if (Array.isArray(room?.cells) && room.cells.length > 0) {
    const unique = new Map()
    for (const value of room.cells) {
      const [rawX, rawZ] = typeof value === 'string'
        ? value.split(':')
        : [value?.x, value?.z]
      const x = Number(rawX)
      const z = Number(rawZ)
      if (Number.isInteger(x) && Number.isInteger(z)) unique.set(roomCellKey(x, z), { x, z })
    }
    if (unique.size > 0) return [...unique.values()].sort((left, right) => left.z - right.z || left.x - right.x)
  }

  const rawMinX = Math.trunc(Number(room?.minX) || 0)
  const rawMaxX = Math.trunc(Number(room?.maxX ?? rawMinX) || rawMinX)
  const rawMinZ = Math.trunc(Number(room?.minZ) || 0)
  const rawMaxZ = Math.trunc(Number(room?.maxZ ?? rawMinZ) || rawMinZ)
  const minX = Math.min(rawMinX, rawMaxX)
  const maxX = Math.max(rawMinX, rawMaxX)
  const minZ = Math.min(rawMinZ, rawMaxZ)
  const maxZ = Math.max(rawMinZ, rawMaxZ)
  const cells = []
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) cells.push({ x, z })
  }
  return cells
}

export function roomBoundaryEdgeKey(start, end) {
  const left = vertexKey(start)
  const right = vertexKey(end)
  return left.localeCompare(right) <= 0 ? `edge:${left}|${right}` : `edge:${right}|${left}`
}

function makeEdge(from, to, side) {
  const dx = to.x - from.x
  const dz = to.z - from.z
  return {
    key: roomBoundaryEdgeKey(from, to),
    from,
    to,
    side,
    axis: Math.abs(dz) <= EPSILON ? 'x' : 'z',
  }
}

export function roomBoundaryEdges(room) {
  const cells = roomGeometryCells(room)
  const cellKeys = new Set(cells.map(cell => roomCellKey(cell.x, cell.z)))
  const edges = []
  for (const { x, z } of cells) {
    if (!cellKeys.has(roomCellKey(x, z - 1))) {
      edges.push(makeEdge(point(x, z), point(x + 1, z), 'north'))
    }
    if (!cellKeys.has(roomCellKey(x + 1, z))) {
      edges.push(makeEdge(point(x + 1, z), point(x + 1, z + 1), 'east'))
    }
    if (!cellKeys.has(roomCellKey(x, z + 1))) {
      edges.push(makeEdge(point(x + 1, z + 1), point(x, z + 1), 'south'))
    }
    if (!cellKeys.has(roomCellKey(x - 1, z))) {
      edges.push(makeEdge(point(x, z + 1), point(x, z), 'west'))
    }
  }
  return edges.sort((left, right) => left.key.localeCompare(right.key))
}

function directionIndex(edge) {
  const dx = clean(edge.to.x - edge.from.x)
  const dz = clean(edge.to.z - edge.from.z)
  if (dx > 0) return 0
  if (dz > 0) return 1
  if (dx < 0) return 2
  return 3
}

function nextBoundaryEdge(current, candidates) {
  const currentDirection = directionIndex(current)
  const priority = [1, 0, 3, 2]
  return [...candidates].sort((left, right) => {
    const leftTurn = (directionIndex(left) - currentDirection + 4) % 4
    const rightTurn = (directionIndex(right) - currentDirection + 4) % 4
    return priority.indexOf(leftTurn) - priority.indexOf(rightTurn) || left.key.localeCompare(right.key)
  })[0]
}

function signedArea(points) {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.z - next.x * current.z
  }
  return clean(area / 2)
}

export function roomBoundaryLoops(room) {
  const edges = roomBoundaryEdges(room)
  const byStart = new Map()
  for (const edge of edges) {
    const key = vertexKey(edge.from)
    if (!byStart.has(key)) byStart.set(key, [])
    byStart.get(key).push(edge)
  }

  const unused = new Map(edges.map(edge => [edge.key, edge]))
  const loops = []
  while (unused.size > 0) {
    const first = [...unused.values()].sort((left, right) => left.key.localeCompare(right.key))[0]
    const loopEdges = []
    let current = first
    let guard = 0
    while (current && guard <= edges.length + 1) {
      guard += 1
      loopEdges.push(current)
      unused.delete(current.key)
      if (samePoint(current.to, first.from)) break
      const candidates = (byStart.get(vertexKey(current.to)) || []).filter(edge => unused.has(edge.key))
      current = candidates.length > 0 ? nextBoundaryEdge(current, candidates) : null
    }
    if (!current || !samePoint(loopEdges.at(-1)?.to, first.from)) continue
    const points = loopEdges.map(edge => edge.from)
    loops.push({
      id: `loop:${loops.length}`,
      edges: loopEdges,
      points,
      area: signedArea(points),
    })
  }
  return loops.sort((left, right) => Math.abs(right.area) - Math.abs(left.area) || left.id.localeCompare(right.id))
}

function sameEdgeDirection(left, right) {
  return clean(left.to.x - left.from.x) === clean(right.to.x - right.from.x)
    && clean(left.to.z - left.from.z) === clean(right.to.z - right.from.z)
}

export function roomBoundaryWallRuns(room) {
  return roomBoundaryLoops(room).flatMap(loop => {
    if (loop.edges.length === 0) return []
    const startIndex = loop.edges.findIndex((edge, index) => (
      !sameEdgeDirection(loop.edges[(index - 1 + loop.edges.length) % loop.edges.length], edge)
    ))
    const rotation = startIndex < 0 ? 0 : startIndex
    const edges = [...loop.edges.slice(rotation), ...loop.edges.slice(0, rotation)]
    const runs = []
    for (const edge of edges) {
      const current = runs.at(-1)
      if (current && sameEdgeDirection(current.edges.at(-1), edge)) {
        current.edges.push(edge)
        current.to = edge.to
        continue
      }
      runs.push({
        from: edge.from,
        to: edge.to,
        axis: edge.axis,
        side: edge.side,
        edges: [edge],
      })
    }
    return runs.map((run, index) => ({
      id: `${loop.id}:wall:${index}:${run.edges.map(edge => edge.key).join(',')}`,
      from: run.from,
      to: run.to,
      axis: run.axis,
      side: run.side,
      edgeKeys: run.edges.map(edge => edge.key),
    }))
  })
}

export function roomSelectableWallRuns(room) {
  const openKeys = new Set((room?.openWallEdgeKeys || []).map(String))
  const coveredByArc = new Set()
  const arcs = []

  for (const arc of Array.isArray(room?.boundaryArcs) ? room.boundaryArcs : []) {
    const edgeKeys = [...new Set((arc?.edgeKeys || []).map(String))]
    const geometry = describeRoomBoundaryArc(arc)
    if (!geometry || edgeKeys.length === 0) continue
    for (const key of edgeKeys) coveredByArc.add(key)
    if (edgeKeys.every(key => openKeys.has(key))) continue
    arcs.push({
      id: `selectable-arc:${arc.id}`,
      axis: 'arc',
      from: geometry.start,
      to: geometry.end,
      edgeKeys,
      points: sampleRoomBoundaryArc(arc),
      arcId: arc.id,
    })
  }

  const straight = roomBoundaryWallRuns(room).filter(run => (
    !run.edgeKeys.some(key => coveredByArc.has(key))
    && !run.edgeKeys.every(key => openKeys.has(key))
  ))
  return [...straight, ...arcs]
}

function locateSelectedRun(loop, selectedKeys) {
  const selected = new Set(selectedKeys)
  const count = loop.edges.filter(edge => selected.has(edge.key)).length
  if (count !== selected.size || count < 2 || count >= loop.edges.length) return null
  const starts = []
  for (let index = 0; index < loop.edges.length; index += 1) {
    if (!selected.has(loop.edges[index].key)) continue
    const previous = loop.edges[(index - 1 + loop.edges.length) % loop.edges.length]
    if (!selected.has(previous.key)) starts.push(index)
  }
  if (starts.length !== 1) return null
  const ordered = []
  let index = starts[0]
  while (selected.has(loop.edges[index].key) && ordered.length <= selected.size) {
    ordered.push(loop.edges[index])
    index = (index + 1) % loop.edges.length
  }
  return ordered.length === selected.size ? { startIndex: starts[0], edges: ordered } : null
}

export function selectedRoomBoundaryChain(room, edgeKeys) {
  const selected = [...new Set((edgeKeys || []).map(String))]
  const selectedSet = new Set(selected)
  const wallRuns = roomBoundaryWallRuns(room)
  const touchedWallRuns = wallRuns.filter(run => run.edgeKeys.some(key => selectedSet.has(key)))
  if (touchedWallRuns.length < 2) return { error: 'Sélectionne au moins deux murs.' }
  if (touchedWallRuns.some(run => !run.edgeKeys.every(key => selectedSet.has(key)))) {
    return { error: 'Sélectionne les murs entiers entre deux angles.' }
  }
  const selectedFromRuns = new Set(touchedWallRuns.flatMap(run => run.edgeKeys))
  if (selected.some(key => !selectedFromRuns.has(key))) {
    return { error: 'La sélection contient un segment qui n’appartient pas au contour.' }
  }
  const loops = roomBoundaryLoops(room)
  const matches = loops
    .map(loop => ({ loop, run: locateSelectedRun(loop, selected) }))
    .filter(match => match.run)
  if (matches.length !== 1) {
    return { error: 'Les murs sélectionnés doivent former une seule chaîne continue du contour.' }
  }

  const { loop, run } = matches[0]
  const points = [run.edges[0].from, ...run.edges.map(edge => edge.to)]
  const start = points[0]
  const end = points.at(-1)
  const dx = end.x - start.x
  const dz = end.z - start.z
  if (Math.hypot(dx, dz) <= EPSILON) return { error: 'La chaîne sélectionnée ne peut pas former un arc ouvert.' }

  let deviation = 0
  for (const current of points.slice(1, -1)) {
    deviation += -dz * (current.x - start.x) + dx * (current.z - start.z)
  }
  const side = Math.abs(deviation) <= EPSILON ? 1 : Math.sign(deviation)
  return { loop, run, points, start, end, side }
}

function hashText(value) {
  let hash = 2166136261
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function makeRoomBoundaryArc(room, edgeKeys, angleDegrees = 90, sideMultiplier = 1) {
  const chain = selectedRoomBoundaryChain(room, edgeKeys)
  if (chain.error) return chain
  const angle = Math.max(5, Math.min(175, Number(angleDegrees) || 90))
  const side = chain.side * (Number(sideMultiplier) < 0 ? -1 : 1)
  const orderedKeys = chain.run.edges.map(edge => edge.key)
  return {
    arc: {
      id: `room-arc:${hashText([...orderedKeys].sort().join('|'))}`,
      edgeKeys: orderedKeys,
      start: point(chain.start.x, chain.start.z),
      end: point(chain.end.x, chain.end.z),
      angleDegrees: clean(angle),
      side,
    },
    chain,
  }
}

export function describeRoomBoundaryArc(arc) {
  const start = point(arc?.start?.x, arc?.start?.z)
  const end = point(arc?.end?.x, arc?.end?.z)
  const dx = end.x - start.x
  const dz = end.z - start.z
  const chord = Math.hypot(dx, dz)
  if (chord <= EPSILON) return null

  const angle = Math.max(5, Math.min(175, Number(arc?.angleDegrees) || 90)) * Math.PI / 180
  const side = Number(arc?.side) < 0 ? -1 : 1
  const radius = chord / (2 * Math.sin(angle / 2))
  const centerDistance = Math.sqrt(Math.max(0, radius * radius - chord * chord / 4))
  const normalX = -dz / chord
  const normalZ = dx / chord
  const center = point(
    (start.x + end.x) / 2 - normalX * side * centerDistance,
    (start.z + end.z) / 2 - normalZ * side * centerDistance,
  )
  const startAngle = Math.atan2(start.z - center.z, start.x - center.x)
  const sweep = -side * angle
  return {
    center,
    radius: clean(radius),
    startAngle,
    sweep,
    length: clean(Math.abs(radius * sweep)),
    start,
    end,
  }
}

export function sampleWallArcGeometry(geometry, density = 8) {
  const centerX = Number(geometry?.center?.x ?? geometry?.centerX)
  const centerZ = Number(geometry?.center?.z ?? geometry?.centerZ)
  const radius = Number(geometry?.radius)
  const startAngle = Number(geometry?.startAngle)
  const sweep = Number(geometry?.sweep)
  if (![centerX, centerZ, radius, startAngle, sweep].every(Number.isFinite) || radius <= EPSILON) return []
  const sampleCount = Math.max(2, Math.min(256, Math.ceil(
    Math.abs(radius * sweep) * Math.max(2, Number(density) || 8),
  )))
  const points = Array.from({ length: sampleCount + 1 }, (_, index) => {
    const angle = startAngle + sweep * (index / sampleCount)
    return point(centerX + Math.cos(angle) * radius, centerZ + Math.sin(angle) * radius)
  })
  const start = geometry?.start || geometry?.from
  const end = geometry?.end || geometry?.to
  const startX = Number(start?.x ?? geometry?.x0)
  const startZ = Number(start?.z ?? geometry?.z0)
  const endX = Number(end?.x ?? geometry?.x1)
  const endZ = Number(end?.z ?? geometry?.z1)
  if ([startX, startZ].every(Number.isFinite)) points[0] = point(startX, startZ)
  if ([endX, endZ].every(Number.isFinite)) points[points.length - 1] = point(endX, endZ)
  return points
}

export function sampleRoomBoundaryArc(arc, density = 8) {
  const geometry = describeRoomBoundaryArc(arc)
  if (!geometry) return [point(arc?.start?.x, arc?.start?.z), point(arc?.end?.x, arc?.end?.z)]
  const points = sampleWallArcGeometry(geometry, density)
  if (points.length < 2) return [geometry.start, geometry.end]
  points[0] = geometry.start
  points[points.length - 1] = geometry.end
  return points
}

function appendPoints(target, source) {
  for (const value of source) {
    if (target.length === 0 || !samePoint(target.at(-1), value)) target.push(value)
  }
}

function contourForLoop(loop, room) {
  const arcs = (Array.isArray(room?.boundaryArcs) ? room.boundaryArcs : [])
    .map(arc => ({ arc, run: locateSelectedRun(loop, arc?.edgeKeys || []) }))
    .filter(item => item.run)
  if (arcs.length === 0) return loop.points

  const selectedByKey = new Map()
  for (const { arc } of arcs) {
    for (const key of arc.edgeKeys) {
      if (selectedByKey.has(key)) return loop.points
      selectedByKey.set(key, arc.id)
    }
  }
  const rotation = loop.edges.findIndex(edge => !selectedByKey.has(edge.key))
  if (rotation < 0) return loop.points
  const edges = [...loop.edges.slice(rotation), ...loop.edges.slice(0, rotation)]
  const runByStart = new Map()
  for (const { arc } of arcs) {
    const selected = new Set(arc.edgeKeys)
    const startIndex = edges.findIndex((edge, index) => (
      selected.has(edge.key) && !selected.has(edges[(index - 1 + edges.length) % edges.length].key)
    ))
    if (startIndex < 0) continue
    let count = 0
    while (count < edges.length && selected.has(edges[(startIndex + count) % edges.length].key)) count += 1
    if (count !== selected.size) continue
    runByStart.set(startIndex, { arc, count })
  }

  const points = []
  for (let index = 0; index < edges.length;) {
    const replacement = runByStart.get(index)
    if (replacement) {
      let arcPoints = sampleRoomBoundaryArc(replacement.arc)
      if (!samePoint(edges[index].from, replacement.arc.start)) arcPoints = [...arcPoints].reverse()
      appendPoints(points, arcPoints)
      index += replacement.count
      continue
    }
    appendPoints(points, [edges[index].from, edges[index].to])
    index += 1
  }
  if (points.length > 1 && samePoint(points[0], points.at(-1))) points.pop()
  return points
}

function rawRoomBoundaryContours(room) {
  return roomBoundaryLoops(room).map(loop => {
    const points = contourForLoop(loop, room)
    return {
      id: loop.id,
      points,
      area: signedArea(points),
      isHole: loop.area < 0,
    }
  })
}

function pointInRing(target, ring) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const current = ring[index]
    const before = ring[previous]
    const crosses = (current.z > target.z) !== (before.z > target.z)
      && target.x < ((before.x - current.x) * (target.z - current.z)) / (before.z - current.z) + current.x
    if (crosses) inside = !inside
  }
  return inside
}

function closedCoordinateRing(points) {
  if (!Array.isArray(points) || points.length < 3) return null
  const coordinates = points.map(value => [clean(value.x), clean(value.z)])
  const first = coordinates[0]
  const last = coordinates.at(-1)
  if (first[0] !== last[0] || first[1] !== last[1]) coordinates.push([...first])
  return coordinates
}

function contoursToMultiPolygon(contours) {
  const outers = contours.filter(contour => !contour.isHole && contour.points.length >= 3)
  const holes = contours.filter(contour => contour.isHole && contour.points.length >= 3)
  return outers.map(outer => {
    const outerRing = closedCoordinateRing(outer.points)
    const containedHoles = holes
      .filter(hole => pointInRing(hole.points[0], outer.points))
      .map(hole => closedCoordinateRing(hole.points))
      .filter(Boolean)
    return [outerRing, ...containedHoles]
  }).filter(polygon => polygon[0])
}

function multiPolygonToContours(multiPolygon) {
  return (Array.isArray(multiPolygon) ? multiPolygon : []).flatMap((polygon, polygonIndex) => (
    (Array.isArray(polygon) ? polygon : []).map((ring, ringIndex) => {
      const points = (Array.isArray(ring) ? ring : [])
        .slice(0, -1)
        .map(value => point(value?.[0], value?.[1]))
      return {
        id: `polygon:${polygonIndex}:ring:${ringIndex}`,
        polygonIndex,
        ringIndex,
        points,
        area: signedArea(points),
        isHole: ringIndex > 0,
      }
    }).filter(contour => contour.points.length >= 3)
  ))
}

export function multiPolygonContours(multiPolygon) {
  return multiPolygonToContours(multiPolygon)
}

function cloneMultiPolygon(multiPolygon) {
  return (Array.isArray(multiPolygon) ? multiPolygon : []).map(polygon => (
    (Array.isArray(polygon) ? polygon : []).map(ring => (
      (Array.isArray(ring) ? ring : []).map(coordinate => [Number(coordinate?.[0]), Number(coordinate?.[1])])
    ))
  ))
}

function explicitVerticalSlices(room) {
  const slices = room?.verticalProfile?.slices
  if (!Array.isArray(slices) || slices.length === 0) return null
  return [...slices]
    .sort((left, right) => Number(left?.offset) - Number(right?.offset))
    .map(slice => ({
      offset: Number(slice.offset),
      footprint: cloneMultiPolygon(slice.footprint),
      wallPaths: Array.isArray(slice.wallPaths) ? slice.wallPaths.map(path => ({ ...path })) : [],
    }))
}

function legacyRoomHeightLevels(room, storyHeight = 2.5) {
  return Math.max(1, Number.parseInt(room?.heightLevels, 10)
    || Math.round((Number(room?.height) || storyHeight) / storyHeight)
    || 1)
}

function straightPathsFromMultiPolygon(multiPolygon) {
  const paths = multiPolygonToContours(multiPolygon).flatMap((contour, contourIndex) => (
    contour.points.map((from, index) => {
      const to = contour.points[(index + 1) % contour.points.length]
      const dx = to.x - from.x
      const dz = to.z - from.z
      return {
        id: `profile:${contourIndex}:${index}:${clean(from.x)}:${clean(from.z)}:${clean(to.x)}:${clean(to.z)}`,
        axis: Math.abs(dz) <= EPSILON ? 'x' : Math.abs(dx) <= EPSILON ? 'z' : 'segment',
        x0: clean(from.x),
        z0: clean(from.z),
        x1: clean(to.x),
        z1: clean(to.z),
      }
    })
  ))
  return paths.map(path => withInteriorNormalSign(path, multiPolygon))
}

function pathMidpointAndLeftNormal(path) {
  if (path?.axis === 'arc') {
    const centerX = Number(path.centerX ?? path.curveCenterX)
    const centerZ = Number(path.centerZ ?? path.curveCenterZ)
    const radius = Number(path.radius ?? path.curveRadius)
    const startAngle = Number(path.startAngle ?? path.curveStartAngle)
    const sweep = Number(path.sweep ?? path.curveSweep)
    if ([centerX, centerZ, radius, startAngle, sweep].every(Number.isFinite)
      && radius > EPSILON && Math.abs(sweep) > EPSILON) {
      const angle = startAngle + sweep / 2
      const direction = Math.sign(sweep)
      const tangentX = -Math.sin(angle) * direction
      const tangentZ = Math.cos(angle) * direction
      return {
        midpoint: {
          x: centerX + Math.cos(angle) * radius,
          z: centerZ + Math.sin(angle) * radius,
        },
        leftNormal: { x: -tangentZ, z: tangentX },
        length: Math.abs(radius * sweep),
      }
    }
  }

  const x0 = Number(path?.x0)
  const z0 = Number(path?.z0)
  const x1 = Number(path?.x1)
  const z1 = Number(path?.z1)
  const dx = x1 - x0
  const dz = z1 - z0
  const length = Math.hypot(dx, dz)
  if (![x0, z0, x1, z1, length].every(Number.isFinite) || length <= EPSILON) return null
  return {
    midpoint: { x: (x0 + x1) / 2, z: (z0 + z1) / 2 },
    leftNormal: { x: -dz / length, z: dx / length },
    length,
  }
}

function withInteriorNormalSign(path, footprint) {
  const geometry = pathMidpointAndLeftNormal(path)
  if (!geometry || !Array.isArray(footprint) || footprint.length === 0) {
    return {
      ...path,
      interiorNormalSign: Number(path?.interiorNormalSign) < 0 ? -1 : 1,
    }
  }
  const probeDistance = Math.max(1e-5, Math.min(1e-3, geometry.length / 1000))
  const leftProbe = {
    x: geometry.midpoint.x + geometry.leftNormal.x * probeDistance,
    z: geometry.midpoint.z + geometry.leftNormal.z * probeDistance,
  }
  const rightProbe = {
    x: geometry.midpoint.x - geometry.leftNormal.x * probeDistance,
    z: geometry.midpoint.z - geometry.leftNormal.z * probeDistance,
  }
  const leftIsInterior = multiPolygonContainsPoint(footprint, leftProbe)
  const rightIsInterior = multiPolygonContainsPoint(footprint, rightProbe)
  const interiorNormalSign = leftIsInterior !== rightIsInterior
    ? (leftIsInterior ? 1 : -1)
    : (Number(path?.interiorNormalSign) < 0 ? -1 : 1)
  return { ...path, interiorNormalSign }
}

export function wallPathEndpointFrame(path, atStart = true) {
  const x0 = Number(path?.x0)
  const z0 = Number(path?.z0)
  const x1 = Number(path?.x1)
  const z1 = Number(path?.z1)
  if (![x0, z0, x1, z1].every(Number.isFinite)) return null
  let tangentX = x1 - x0
  let tangentZ = z1 - z0
  if (path?.axis === 'arc') {
    const startAngle = Number(path.startAngle ?? path.curveStartAngle)
    const sweep = Number(path.sweep ?? path.curveSweep)
    if (Number.isFinite(startAngle) && Number.isFinite(sweep) && Math.abs(sweep) > EPSILON) {
      const angle = atStart ? startAngle : startAngle + sweep
      const direction = Math.sign(sweep)
      tangentX = -Math.sin(angle) * direction
      tangentZ = Math.cos(angle) * direction
    }
  }
  const length = Math.hypot(tangentX, tangentZ)
  if (!Number.isFinite(length) || length <= EPSILON) return null
  const tangent = { x: tangentX / length, z: tangentZ / length }
  return {
    point: atStart ? { x: x0, z: z0 } : { x: x1, z: z1 },
    tangent,
    normal: { x: -tangent.z, z: tangent.x },
  }
}

export function wallMiterOffsetVector(normal, neighborNormal, maximumScale = 4) {
  const sumX = Number(normal?.x) + Number(neighborNormal?.x)
  const sumZ = Number(normal?.z) + Number(neighborNormal?.z)
  const sumLength = Math.hypot(sumX, sumZ)
  if (![sumX, sumZ, sumLength].every(Number.isFinite) || sumLength <= EPSILON) return null
  const bisector = { x: sumX / sumLength, z: sumZ / sumLength }
  const denominator = bisector.x * Number(normal?.x) + bisector.z * Number(normal?.z)
  if (!Number.isFinite(denominator) || denominator <= 0.2) return null
  const vector = { x: bisector.x / denominator, z: bisector.z / denominator }
  return Math.hypot(vector.x, vector.z) <= Math.max(1, Number(maximumScale) || 4)
    ? vector
    : null
}

export function wallCornerIntersectionPoint({
  point: origin,
  tangent,
  normal,
  distance,
  neighborNormal,
  neighborDistance,
  minimumDenominator = 0.2,
}) {
  const denominator = Number(tangent?.x) * Number(neighborNormal?.x)
    + Number(tangent?.z) * Number(neighborNormal?.z)
  if (!Number.isFinite(denominator) || Math.abs(denominator) <= minimumDenominator) return null
  const normalDot = Number(normal?.x) * Number(neighborNormal?.x)
    + Number(normal?.z) * Number(neighborNormal?.z)
  const along = (Number(neighborDistance) - Number(distance) * normalDot) / denominator
  const x = Number(origin?.x) + Number(normal?.x) * Number(distance) + Number(tangent?.x) * along
  const z = Number(origin?.z) + Number(normal?.z) * Number(distance) + Number(tangent?.z) * along
  return [x, z, along].every(Number.isFinite) ? { x, z, along } : null
}

export function withWallMiterJoins(inputWalls, styleKeyForWall) {
  const walls = Array.isArray(inputWalls) ? inputWalls : []
  if (typeof styleKeyForWall !== 'function' || walls.length < 2) return walls
  const endpoints = new Map()
  walls.forEach((wall, wallIndex) => {
    const styleKey = styleKeyForWall(wall)
    if (!styleKey) return
    for (const atStart of [true, false]) {
      const frame = wallPathEndpointFrame(wall, atStart)
      if (!frame) continue
      const key = [
        styleKey,
        clean(frame.point.x),
        clean(frame.point.z),
        clean(wall.y),
        clean(wall.height),
      ].join('|')
      if (!endpoints.has(key)) endpoints.set(key, [])
      endpoints.get(key).push({ wallIndex, atStart, frame })
    }
  })

  const result = [...walls]
  for (const entries of endpoints.values()) {
    if (entries.length !== 2 || entries[0].wallIndex === entries[1].wallIndex) continue
    const [left, right] = entries
    const leftMiter = wallMiterOffsetVector(left.frame.normal, right.frame.normal)
    const rightMiter = wallMiterOffsetVector(right.frame.normal, left.frame.normal)
    if (!leftMiter || !rightMiter) continue
    for (const [entry, miter] of [[left, leftMiter], [right, rightMiter]]) {
      const field = entry.atStart ? 'profileJoinStartMiter' : 'profileJoinEndMiter'
      result[entry.wallIndex] = { ...result[entry.wallIndex], [field]: miter }
    }
  }
  return result
}

function wallCornerJoinSnapshot(wall, frame) {
  return {
    id: wall.id || null,
    normal: frame.normal,
    thickness: wall.thickness,
    elevationProfileMode: wall.elevationProfileMode,
    elevationProfile: wall.elevationProfile || null,
    elevationProfileDirection: wall.elevationProfileDirection,
    frontElevationProfile: wall.frontElevationProfile || null,
    backElevationProfile: wall.backElevationProfile || null,
    elevationProfileOriginY: wall.elevationProfileOriginY,
    elevationProfileHeight: wall.elevationProfileHeight,
    frontRole: wall.frontRole || null,
    backRole: wall.backRole || null,
    frontRoomIds: [...(wall.frontRoomIds || [])],
    backRoomIds: [...(wall.backRoomIds || [])],
    frontSourceWorldIds: [...(wall.frontSourceWorldIds || [])],
    backSourceWorldIds: [...(wall.backSourceWorldIds || [])],
  }
}

function wallCornerFaceOwnerIds(wall, side) {
  return [...new Set([
    ...(wall?.[`${side}RoomIds`] || []),
    ...(wall?.[`${side}SourceWorldIds`] || []),
  ].filter(Boolean).map(String))]
}

function wallHasCornerFaceOwners(wall) {
  return wallCornerFaceOwnerIds(wall, 'front').length > 0
    || wallCornerFaceOwnerIds(wall, 'back').length > 0
}

function wallCornerFaceMatch(wall, entry, side, candidates, walls) {
  const ownOwners = new Set(wallCornerFaceOwnerIds(wall, side))
  const ownHasMetadata = wallHasCornerFaceOwners(wall)
  const ownRole = wall?.[`${side}Role`] || null
  const matches = []
  for (const neighborEntry of candidates) {
    const neighbor = walls[neighborEntry.wallIndex]
    const neighborHasMetadata = wallHasCornerFaceOwners(neighbor)
    const topologySide = entry.atStart !== neighborEntry.atStart
      ? side
      : side === 'front' ? 'back' : 'front'
    for (const neighborSide of ['front', 'back']) {
      const neighborOwners = wallCornerFaceOwnerIds(neighbor, neighborSide)
      const sharedOwnerCount = neighborOwners.filter(ownerId => ownOwners.has(ownerId)).length
      if (ownHasMetadata && neighborHasMetadata) {
        if (ownOwners.size > 0 && sharedOwnerCount === 0) continue
        if (ownOwners.size === 0 && neighborOwners.length > 0) continue
      }
      let score = sharedOwnerCount * 100
      if (ownHasMetadata && neighborHasMetadata && ownOwners.size === 0 && neighborOwners.length === 0) score += 100
      if (ownRole && neighbor?.[`${neighborSide}Role`] === ownRole) score += 10
      if (neighborSide === topologySide) score += 1
      matches.push({ neighborEntry, neighborSide, score })
    }
  }
  matches.sort((left, right) => (
    right.score - left.score
    || left.neighborEntry.wallIndex - right.neighborEntry.wallIndex
    || left.neighborSide.localeCompare(right.neighborSide)
  ))
  return matches[0] || null
}

function wallsShareCornerOwner(left, right, ownerIdsForWall) {
  if (typeof ownerIdsForWall !== 'function') return true
  const leftOwners = new Set((ownerIdsForWall(left) || []).filter(Boolean).map(String))
  const rightOwners = (ownerIdsForWall(right) || []).filter(Boolean).map(String)
  if (leftOwners.size === 0 || rightOwners.length === 0) return true
  return rightOwners.some(ownerId => leftOwners.has(ownerId))
}

/**
 * Derive a real corner joint between adjacent wall volumes.
 *
 * Unlike a static miter, the descriptor keeps the neighboring wall profile so
 * the renderer can intersect both faces again at every vertical profile level.
 * This closes a corner even when only one wall is curved/faceted, or when the
 * two walls use different profile depths.
 */
export function withWallCornerJoins(inputWalls, ownerIdsForWall = null) {
  const walls = Array.isArray(inputWalls) ? inputWalls : []
  if (walls.length < 2) return walls
  const endpoints = new Map()
  walls.forEach((wall, wallIndex) => {
    for (const atStart of [true, false]) {
      const frame = wallPathEndpointFrame(wall, atStart)
      if (!frame) continue
      const key = [
        clean(frame.point.x),
        clean(frame.point.z),
        clean(wall.y),
        clean(wall.height),
      ].join('|')
      if (!endpoints.has(key)) endpoints.set(key, [])
      endpoints.get(key).push({ wallIndex, atStart, frame })
    }
  })

  const result = [...walls]
  for (const entries of endpoints.values()) {
    for (const entry of entries) {
      const wall = walls[entry.wallIndex]
      const candidates = entries.filter(candidate => {
        if (candidate.wallIndex === entry.wallIndex) return false
        const neighbor = walls[candidate.wallIndex]
        if (!wallsShareCornerOwner(wall, neighbor, ownerIdsForWall)) return false
        const denominator = entry.frame.tangent.x * candidate.frame.normal.x
          + entry.frame.tangent.z * candidate.frame.normal.z
        return Math.abs(denominator) > 0.2
      })
      if (candidates.length === 0) continue
      const frontMatch = wallCornerFaceMatch(wall, entry, 'front', candidates, walls)
      const backMatch = wallCornerFaceMatch(wall, entry, 'back', candidates, walls)
      if (!frontMatch && !backMatch) continue
      const faceJoin = match => {
        if (!match) return null
        const neighbor = walls[match.neighborEntry.wallIndex]
        return {
          neighbor: wallCornerJoinSnapshot(neighbor, match.neighborEntry.frame),
          neighborSide: match.neighborSide,
        }
      }
      const front = faceJoin(frontMatch)
      const back = faceJoin(backMatch)
      const descriptor = {
        normal: entry.frame.normal,
        tangent: entry.frame.tangent,
        ...(front ? { front } : {}),
        ...(back ? { back } : {}),
      }
      const sameNeighbor = frontMatch && backMatch
        && frontMatch.neighborEntry.wallIndex === backMatch.neighborEntry.wallIndex
      if (sameNeighbor) {
        descriptor.neighbor = front.neighbor
        descriptor.frontNeighborSide = front.neighborSide
        descriptor.backNeighborSide = back.neighborSide
      }
      const field = entry.atStart ? 'profileJoinStart' : 'profileJoinEnd'
      const miterField = entry.atStart ? 'profileJoinStartMiter' : 'profileJoinEndMiter'
      const miter = sameNeighbor
        ? wallMiterOffsetVector(entry.frame.normal, frontMatch.neighborEntry.frame.normal)
        : null
      result[entry.wallIndex] = {
        ...result[entry.wallIndex],
        [field]: descriptor,
        ...(miter ? { [miterField]: miter } : {}),
      }
    }
  }
  return result
}

export function normalizeWallElevationProfile(profile) {
  const type = ['curved', 'faceted'].includes(profile?.type) ? profile.type : 'vertical'
  if (type === 'vertical') return { type: 'vertical', depth: 0, direction: 1 }
  return {
    type,
    depth: clean(Math.max(0, Math.min(5, Number(profile?.depth) || 0))),
    direction: Number(profile?.direction) < 0 ? -1 : 1,
  }
}

function pathSourceEdgeKeys(room, path) {
  if (Array.isArray(path?.sourceEdgeKeys) && path.sourceEdgeKeys.length > 0) {
    return [...new Set(path.sourceEdgeKeys.map(String))]
  }
  if (path?.curveArcId) {
    const arc = (room?.boundaryArcs || []).find(item => item?.id === path.curveArcId)
    if (arc?.edgeKeys?.length > 0) return [...new Set(arc.edgeKeys.map(String))]
  }
  if ([path?.x0, path?.z0, path?.x1, path?.z1].every(Number.isFinite)) {
    return [roomBoundaryEdgeKey(point(path.x0, path.z0), point(path.x1, path.z1))]
  }
  return []
}

export function roomWallElevationProfileForEdges(room, edgeKeys) {
  const selected = new Set((edgeKeys || []).map(String))
  const entry = (room?.wallElevationProfiles || []).find(profile => (
    (profile?.edgeKeys || []).some(key => selected.has(String(key)))
  ))
  return normalizeWallElevationProfile(entry?.profile)
}

export function roomWallAppearanceForEdges(room, edgeKeys) {
  const selected = new Set((edgeKeys || []).map(String))
  if (selected.size === 0) return null
  const entry = (room?.wallAppearanceProfiles || []).find(profile => (
    (profile?.edgeKeys || []).some(key => selected.has(String(key)))
  ))
  if (!entry) return null
  return {
    interiorTex: entry.interiorTex || null,
    interiorMaterial: entry.interiorMaterial || null,
  }
}

function withRoomWallElevationProfile(room, path) {
  const sourceEdgeKeys = pathSourceEdgeKeys(room, path)
  const elevationProfile = roomWallElevationProfileForEdges(room, sourceEdgeKeys)
  const wallAppearance = roomWallAppearanceForEdges(room, sourceEdgeKeys)
  return {
    ...path,
    ...(sourceEdgeKeys.length > 0 ? { sourceEdgeKeys } : {}),
    ...(elevationProfile.type !== 'vertical' ? { elevationProfile } : {}),
    ...(wallAppearance ? { wallAppearance } : {}),
  }
}

function multiPolygonsHaveSameArea(left, right) {
  if (left.length === 0 || right.length === 0) return left.length === right.length
  const leftOnly = polygonClipping.difference(left, right)
  const rightOnly = polygonClipping.difference(right, left)
  return multiPolygonArea(leftOnly) <= EPSILON && multiPolygonArea(rightOnly) <= EPSILON
}

export function roomBoundaryMultiPolygon(room, roomLookup = {}, visitedRoomIds = new Set()) {
  const profile = explicitVerticalSlices(room)
  if (profile?.[0]?.footprint?.length > 0) return cloneMultiPolygon(profile[0].footprint)
  const subject = contoursToMultiPolygon(rawRoomBoundaryContours(room))
  if (subject.length === 0) return []
  const currentId = String(room?.id || '')
  const visited = new Set(visitedRoomIds)
  if (currentId) visited.add(currentId)
  const clips = []
  for (const clipId of [...new Set(room?.geometryClipRoomIds || [])]) {
    if (!clipId || visited.has(String(clipId))) continue
    const clipRoom = roomLookup?.[clipId]
    if (!clipRoom) continue
    const clipGeometry = roomBoundaryMultiPolygon(
      { id: clipId, ...clipRoom },
      roomLookup,
      visited,
    )
    if (clipGeometry.length > 0) clips.push(clipGeometry)
  }
  return clips.length > 0 ? polygonClipping.difference(subject, ...clips) : subject
}

export function roomBoundaryContours(room, roomLookup = {}) {
  return multiPolygonToContours(roomBoundaryMultiPolygon(room, roomLookup))
}

export function multiPolygonArea(multiPolygon) {
  return multiPolygonToContours(multiPolygon).reduce((sum, contour) => (
    sum + (contour.isHole ? -Math.abs(contour.area) : Math.abs(contour.area))
  ), 0)
}

export function intersectMultiPolygons(...values) {
  const polygons = values.filter(value => Array.isArray(value) && value.length > 0)
  if (polygons.length !== values.length || polygons.length === 0) return []
  return cloneMultiPolygon(polygonClipping.intersection(...polygons))
}

export function multiPolygonBounds(multiPolygon) {
  const points = multiPolygonToContours(multiPolygon).flatMap(contour => contour.points)
  if (points.length === 0) return null
  return {
    minX: Math.min(...points.map(value => value.x)),
    maxX: Math.max(...points.map(value => value.x)),
    minZ: Math.min(...points.map(value => value.z)),
    maxZ: Math.max(...points.map(value => value.z)),
  }
}

function elevationProfileOffset(profile, progress) {
  const depth = Math.max(0, Number(profile?.depth) || 0)
  const direction = Number(profile?.direction) < 0 ? -1 : 1
  const t = Math.max(0, Math.min(1, Number(progress) || 0))
  if (profile?.type === 'curved') return depth * direction * Math.sin(Math.PI * t)
  if (profile?.type === 'faceted') return depth * direction * (1 - Math.abs(t * 2 - 1))
  return 0
}

export function roomInteriorFootprintAtY(room, y, roomLookup = {}, storyHeight = 2.5) {
  const baseY = Number.isFinite(Number(room?.y))
    ? Number(room.y)
    : (Number(room?.level) || 0) * storyHeight
  const levels = roomMaximumHeightLevels(room, storyHeight)
  const offset = Math.floor((Number(y) - baseY + EPSILON) / storyHeight)
  const slice = roomSliceAtLevel(room, offset, roomLookup, storyHeight)
  if (!slice) return []
  const progress = Math.max(0, Math.min(1, (Number(y) - baseY) / Math.max(EPSILON, levels * storyHeight)))
  const strips = []

  for (const path of slice.wallPaths || []) {
    const inward = elevationProfileOffset(path.elevationProfile, progress)
    if (inward <= EPSILON) continue
    const points = path.axis === 'arc'
      ? sampleWallArcGeometry(path, 16)
      : [point(path.x0, path.z0), point(path.x1, path.z1)]
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index]
      const to = points[index + 1]
      const dx = to.x - from.x
      const dz = to.z - from.z
      const length = Math.hypot(dx, dz)
      if (length <= EPSILON) continue
      const sign = Number(path.interiorNormalSign) < 0 ? -1 : 1
      const normal = { x: -dz / length * sign, z: dx / length * sign }
      strips.push([[[
        [from.x, from.z],
        [to.x, to.z],
        [to.x + normal.x * inward, to.z + normal.z * inward],
        [from.x + normal.x * inward, from.z + normal.z * inward],
        [from.x, from.z],
      ]]])
    }
  }
  return strips.length > 0
    ? cloneMultiPolygon(polygonClipping.difference(slice.footprint, ...strips))
    : cloneMultiPolygon(slice.footprint)
}

export function roomVolumeContainsPoint(room, point3D, roomLookup = {}, storyHeight = 2.5) {
  const x = Number(point3D?.x)
  const y = Number(point3D?.y)
  const z = Number(point3D?.z)
  if (![x, y, z].every(Number.isFinite)) return false
  const baseY = Number.isFinite(Number(room?.y))
    ? Number(room.y)
    : (Number(room?.level) || 0) * storyHeight
  const topY = baseY + roomMaximumHeightLevels(room, storyHeight) * storyHeight
  if (y < baseY - EPSILON || y >= topY - EPSILON) return false
  return multiPolygonContainsPoint(
    roomInteriorFootprintAtY(room, y, roomLookup, storyHeight),
    { x, z },
  )
}

export function roomGeometryArea(room, roomLookup = {}) {
  return clean(multiPolygonArea(roomBoundaryMultiPolygon(room, roomLookup)))
}

export function roomGeometryIntersectionArea(leftRoom, rightRoom, roomLookup = {}) {
  const left = roomBoundaryMultiPolygon(leftRoom, roomLookup)
  const right = roomBoundaryMultiPolygon(rightRoom, roomLookup)
  if (left.length === 0 || right.length === 0) return 0
  return clean(multiPolygonArea(polygonClipping.intersection(left, right)))
}

function roomVerticalSpan(room, storyHeight) {
  const baseY = Number.isFinite(Number(room?.y))
    ? Number(room.y)
    : (Number(room?.level) || 0) * storyHeight
  const levels = Math.max(1, Number.parseInt(room?.heightLevels, 10)
    || Math.round((Number(room?.height) || storyHeight) / storyHeight)
    || 1)
  return { baseY, topY: baseY + levels * storyHeight }
}

function roomsOverlapVertically(left, right, storyHeight) {
  const a = roomVerticalSpan(left, storyHeight)
  const b = roomVerticalSpan(right, storyHeight)
  return a.topY > b.baseY + EPSILON && b.topY > a.baseY + EPSILON
}

export function migrateRoomGeometryClips(inputRooms, storyHeight = 2.5) {
  let rooms = { ...(inputRooms || {}) }
  const roomIds = Object.keys(rooms)
  for (let ownerIndex = 0; ownerIndex < roomIds.length; ownerIndex += 1) {
    const ownerId = roomIds[ownerIndex]
    const owner = rooms[ownerId]
    if (!Array.isArray(owner?.boundaryArcs) || owner.boundaryArcs.length === 0) continue
    for (let targetIndex = ownerIndex + 1; targetIndex < roomIds.length; targetIndex += 1) {
      const targetId = roomIds[targetIndex]
      const target = rooms[targetId]
      if (!roomsOverlapVertically(owner, target, storyHeight)) continue
      if ((owner.geometryClipRoomIds || []).includes(targetId)) continue
      if (roomGeometryIntersectionArea(
        { id: ownerId, ...owner },
        { id: targetId, ...target },
        rooms,
      ) <= EPSILON) continue
      rooms = {
        ...rooms,
        [targetId]: {
          ...target,
          geometryClipRoomIds: [...new Set([...(target.geometryClipRoomIds || []), ownerId])],
        },
      }
    }
  }
  return rooms
}

export function multiPolygonContainsPoint(multiPolygon, target) {
  const contours = multiPolygonToContours(multiPolygon)
  const polygons = new Map()
  for (const contour of contours) {
    if (!polygons.has(contour.polygonIndex)) polygons.set(contour.polygonIndex, { outer: null, holes: [] })
    const polygon = polygons.get(contour.polygonIndex)
    if (contour.isHole) polygon.holes.push(contour.points)
    else polygon.outer = contour.points
  }
  return [...polygons.values()].some(polygon => (
    polygon.outer
    && pointInRing(target, polygon.outer)
    && !polygon.holes.some(hole => pointInRing(target, hole))
  ))
}

export function roomGeometryContainsPoint(room, target, roomLookup = {}) {
  return multiPolygonContainsPoint(roomBoundaryMultiPolygon(room, roomLookup), target)
}

export function roomGeometryBounds(room, roomLookup = {}) {
  const points = roomBoundaryContours(room, roomLookup).flatMap(contour => contour.points)
  if (points.length === 0) return null
  return {
    minX: Math.min(...points.map(value => value.x)),
    maxX: Math.max(...points.map(value => value.x)),
    minZ: Math.min(...points.map(value => value.z)),
    maxZ: Math.max(...points.map(value => value.z)),
  }
}

export function roomEffectiveGridCells(room, roomLookup = {}) {
  const bounds = roomGeometryBounds(room, roomLookup)
  if (!bounds) return []
  const cells = []
  for (let z = Math.floor(bounds.minZ); z < Math.ceil(bounds.maxZ); z += 1) {
    for (let x = Math.floor(bounds.minX); x < Math.ceil(bounds.maxX); x += 1) {
      if (roomGeometryContainsPoint(room, { x: x + 0.5, z: z + 0.5 }, roomLookup)) {
        cells.push({ x, z })
      }
    }
  }
  return cells
}

function segmentCoveredByStraightEdges(segment, edges) {
  if (!['x', 'z'].includes(segment.axis)) return false
  const line = segment.axis === 'x' ? segment.z0 : segment.x0
  const start = segment.axis === 'x' ? Math.min(segment.x0, segment.x1) : Math.min(segment.z0, segment.z1)
  const end = segment.axis === 'x' ? Math.max(segment.x0, segment.x1) : Math.max(segment.z0, segment.z1)
  const intervals = edges
    .filter(edge => edge.axis === segment.axis)
    .filter(edge => Math.abs((edge.axis === 'x' ? edge.from.z : edge.from.x) - line) <= EPSILON)
    .map(edge => edge.axis === 'x'
      ? [Math.min(edge.from.x, edge.to.x), Math.max(edge.from.x, edge.to.x)]
      : [Math.min(edge.from.z, edge.to.z), Math.max(edge.from.z, edge.to.z)])
    .sort((left, right) => left[0] - right[0])
  let coveredUntil = start
  for (const interval of intervals) {
    if (interval[1] < coveredUntil - EPSILON) continue
    if (interval[0] > coveredUntil + EPSILON) return false
    coveredUntil = Math.max(coveredUntil, interval[1])
    if (coveredUntil >= end - EPSILON) return true
  }
  return false
}

function openArcSegmentKeys(room, openKeys) {
  const keys = new Set()
  for (const arc of Array.isArray(room?.boundaryArcs) ? room.boundaryArcs : []) {
    if (!(arc?.edgeKeys || []).some(key => openKeys.has(key))) continue
    const points = sampleRoomBoundaryArc(arc)
    for (let index = 0; index < points.length - 1; index += 1) {
      keys.add(roomBoundaryEdgeKey(points[index], points[index + 1]))
    }
  }
  return keys
}

function collectCurveSegmentMetadata(room, roomLookup, result = new Map(), visitedRoomIds = new Set()) {
  const roomId = String(room?.id || '')
  if (roomId && visitedRoomIds.has(roomId)) return result
  const visited = new Set(visitedRoomIds)
  if (roomId) visited.add(roomId)

  for (const arc of Array.isArray(room?.boundaryArcs) ? room.boundaryArcs : []) {
    const geometry = describeRoomBoundaryArc(arc)
    if (!geometry) continue
    const points = sampleRoomBoundaryArc(arc)
    const offsets = points.map((_, index) => geometry.length * index / Math.max(1, points.length - 1))
    const curveId = `${arc.ownerRoomId || roomId || 'room'}:${arc.id}`
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index]
      const to = points[index + 1]
      const key = roomBoundaryEdgeKey(from, to)
      if (result.has(key)) continue
      result.set(key, {
        curveId,
        curveArcId: arc.id,
        curveSourceEdgeKeys: [...new Set((arc.edgeKeys || []).map(String))],
        curveOffset0: clean(offsets[index]),
        curveOffset1: clean(offsets[index + 1]),
        curveLength: geometry.length,
        curveCenterX: geometry.center.x,
        curveCenterZ: geometry.center.z,
        curveRadius: geometry.radius,
        curveStartAngle: geometry.startAngle,
        curveSweep: geometry.sweep,
        curveFrom: from,
        curveTo: to,
      })
    }
  }

  for (const clipId of room?.geometryClipRoomIds || []) {
    const clipRoom = roomLookup?.[clipId]
    if (!clipRoom) continue
    collectCurveSegmentMetadata({ id: clipId, ...clipRoom }, roomLookup, result, visited)
  }
  return result
}

function contourSegmentKeys(room, roomLookup) {
  const keys = new Set()
  for (const contour of roomBoundaryContours(room, roomLookup)) {
    for (let index = 0; index < contour.points.length; index += 1) {
      keys.add(roomBoundaryEdgeKey(
        contour.points[index],
        contour.points[(index + 1) % contour.points.length],
      ))
    }
  }
  return keys
}

export function roomHasEffectiveBoundaryEdge(room, edgeKey, roomLookup = {}) {
  const directArc = (room?.boundaryArcs || []).find(arc => (arc.edgeKeys || []).includes(edgeKey))
  if (directArc) return true

  const baseEdge = roomBoundaryEdges(room).find(edge => edge.key === edgeKey)
  if (baseEdge) {
    const segment = {
      axis: baseEdge.axis,
      x0: baseEdge.from.x,
      z0: baseEdge.from.z,
      x1: baseEdge.to.x,
      z1: baseEdge.to.z,
    }
    const contourEdges = roomBoundaryContours(room, roomLookup).flatMap(contour => (
      contour.points.map((from, index) => {
        const to = contour.points[(index + 1) % contour.points.length]
        return {
          axis: Math.abs(to.z - from.z) <= EPSILON ? 'x' : Math.abs(to.x - from.x) <= EPSILON ? 'z' : 'segment',
          from,
          to,
        }
      })
    ))
    if (segmentCoveredByStraightEdges(segment, contourEdges)) return true
  }

  const ownContourKeys = contourSegmentKeys(room, roomLookup)
  for (const clipId of room?.geometryClipRoomIds || []) {
    const clipRoom = roomLookup?.[clipId]
    if (!clipRoom) continue
    for (const arc of clipRoom.boundaryArcs || []) {
      if (!(arc.edgeKeys || []).includes(edgeKey)) continue
      const points = sampleRoomBoundaryArc(arc)
      for (let index = 0; index < points.length - 1; index += 1) {
        if (ownContourKeys.has(roomBoundaryEdgeKey(points[index], points[index + 1]))) return true
      }
    }
  }
  return false
}

export function roomBoundarySegments(room, roomLookup = {}) {
  const openKeys = new Set(Array.isArray(room?.openWallEdgeKeys) ? room.openWallEdgeKeys : [])
  const openEdges = roomBoundaryEdges(room).filter(edge => openKeys.has(edge.key))
  const openArcKeys = openArcSegmentKeys(room, openKeys)
  const curveMetadata = collectCurveSegmentMetadata(room, roomLookup)
  const footprint = roomBoundaryMultiPolygon(room, roomLookup)
  return roomBoundaryContours(room, roomLookup).flatMap((contour, loopIndex) => (
    contour.points.map((from, index) => {
      const to = contour.points[(index + 1) % contour.points.length]
      const dx = to.x - from.x
      const dz = to.z - from.z
      const curve = curveMetadata.get(roomBoundaryEdgeKey(from, to))
      const sameCurveDirection = curve && samePoint(from, curve.curveFrom)
      const sourceEdgeKey = roomBoundaryEdgeKey(from, to)
      return {
        id: `boundary:${loopIndex}:${index}:${from.x}:${from.z}:${to.x}:${to.z}`,
        loopIndex,
        index,
        axis: Math.abs(dz) <= EPSILON ? 'x' : Math.abs(dx) <= EPSILON ? 'z' : 'segment',
        x0: from.x,
        z0: from.z,
        x1: to.x,
        z1: to.z,
        sourceEdgeKeys: curve?.curveSourceEdgeKeys || [sourceEdgeKey],
        ...(curve ? {
          curveId: curve.curveId,
          curveArcId: curve.curveArcId,
          curveOffset0: sameCurveDirection ? curve.curveOffset0 : curve.curveOffset1,
          curveOffset1: sameCurveDirection ? curve.curveOffset1 : curve.curveOffset0,
          curveLength: curve.curveLength,
          curveCenterX: curve.curveCenterX,
          curveCenterZ: curve.curveCenterZ,
          curveRadius: curve.curveRadius,
          curveStartAngle: curve.curveStartAngle,
          curveSweep: curve.curveSweep,
        } : {}),
      }
    })
  )).map(segment => withInteriorNormalSign(segment, footprint)).filter(segment => (
    !openArcKeys.has(roomBoundaryEdgeKey(
      point(segment.x0, segment.z0),
      point(segment.x1, segment.z1),
    ))
    && !segmentCoveredByStraightEdges(segment, openEdges)
  ))
}

export function roomBoundaryPaths(room, roomLookup = {}) {
  const profile = explicitVerticalSlices(room)
  if (profile?.[0]?.wallPaths?.length > 0) {
    return profile[0].wallPaths.map(path => withRoomWallElevationProfile(
      room,
      withInteriorNormalSign(path, profile[0].footprint),
    ))
  }
  const segments = roomBoundarySegments(room, roomLookup)
  const straight = segments.filter(segment => !segment.curveId)
  const curves = new Map()
  for (const segment of segments.filter(item => item.curveId)) {
    if (!curves.has(segment.curveId)) curves.set(segment.curveId, [])
    curves.get(segment.curveId).push(segment)
  }

  const arcs = []
  for (const [curveId, items] of curves) {
    const first = items[0]
    const curveLength = Number(first.curveLength)
    if (!Number.isFinite(curveLength) || curveLength <= EPSILON) {
      straight.push(...items)
      continue
    }
    const intervals = items
      .map(item => [
        Math.min(Number(item.curveOffset0), Number(item.curveOffset1)),
        Math.max(Number(item.curveOffset0), Number(item.curveOffset1)),
      ])
      .filter(interval => interval.every(Number.isFinite))
      .sort((left, right) => left[0] - right[0])
    const runs = []
    for (const interval of intervals) {
      const current = runs.at(-1)
      if (current && interval[0] <= current[1] + 1e-5) current[1] = Math.max(current[1], interval[1])
      else runs.push([...interval])
    }
    for (const [offsetStart, offsetEnd] of runs) {
      const startProgress = offsetStart / curveLength
      const endProgress = offsetEnd / curveLength
      const startAngle = Number(first.curveStartAngle) + Number(first.curveSweep) * startProgress
      const sweep = Number(first.curveSweep) * (endProgress - startProgress)
      const x0 = Number(first.curveCenterX) + Math.cos(startAngle) * Number(first.curveRadius)
      const z0 = Number(first.curveCenterZ) + Math.sin(startAngle) * Number(first.curveRadius)
      const endAngle = startAngle + sweep
      const x1 = Number(first.curveCenterX) + Math.cos(endAngle) * Number(first.curveRadius)
      const z1 = Number(first.curveCenterZ) + Math.sin(endAngle) * Number(first.curveRadius)
      arcs.push({
        id: `arc:${curveId}:${clean(offsetStart)}:${clean(offsetEnd)}`,
        axis: 'arc',
        curveId,
        curveArcId: first.curveArcId,
        curveOffset0: clean(offsetStart),
        curveOffset1: clean(offsetEnd),
        curveLength: clean(curveLength),
        centerX: Number(first.curveCenterX),
        centerZ: Number(first.curveCenterZ),
        radius: Number(first.curveRadius),
        startAngle,
        sweep,
        x0: clean(x0),
        z0: clean(z0),
        x1: clean(x1),
        z1: clean(z1),
        sourceEdgeKeys: [...new Set(items.flatMap(item => item.sourceEdgeKeys || []))],
      })
    }
  }
  const footprint = roomBoundaryMultiPolygon(room, roomLookup)
  return [...straight, ...arcs].map(path => withRoomWallElevationProfile(
    room,
    withInteriorNormalSign(path, footprint),
  ))
}

export function roomMaximumHeightLevels(room, storyHeight = 2.5) {
  const profile = explicitVerticalSlices(room)
  if (!profile) return legacyRoomHeightLevels(room, storyHeight)
  return Math.max(1, ...profile.map(slice => Number(slice.offset) + 1))
}

export function roomVerticalSlices(room, roomLookup = {}, storyHeight = 2.5) {
  const profile = explicitVerticalSlices(room)
  if (profile) return profile.map(slice => ({
    ...slice,
    wallPaths: slice.wallPaths.map(path => withRoomWallElevationProfile(
      room,
      withInteriorNormalSign(path, slice.footprint),
    )),
  }))
  const footprint = roomBoundaryMultiPolygon(room, roomLookup)
  const wallPaths = roomBoundaryPaths(room, roomLookup)
  return Array.from({ length: legacyRoomHeightLevels(room, storyHeight) }, (_, offset) => ({
    offset,
    footprint: cloneMultiPolygon(footprint),
    wallPaths: wallPaths.map(path => ({ ...path })),
  }))
}

export function roomSliceAtLevel(room, offset, roomLookup = {}, storyHeight = 2.5) {
  const target = Number.parseInt(offset, 10)
  if (!Number.isInteger(target) || target < 0) return null
  return roomVerticalSlices(room, roomLookup, storyHeight).find(slice => slice.offset === target) || null
}

export function roomSliceContours(room, offset, roomLookup = {}, storyHeight = 2.5) {
  const slice = roomSliceAtLevel(room, offset, roomLookup, storyHeight)
  return slice ? multiPolygonToContours(slice.footprint) : []
}

export function roomCeilingRegions(room, roomLookup = {}, storyHeight = 2.5) {
  const slices = roomVerticalSlices(room, roomLookup, storyHeight)
  return slices.flatMap((slice, index) => {
    const next = slices[index + 1]
    const footprint = next
      ? polygonClipping.difference(slice.footprint, next.footprint)
      : cloneMultiPolygon(slice.footprint)
    if (multiPolygonArea(footprint) <= EPSILON) return []
    return [{
      offset: slice.offset,
      topOffset: slice.offset + 1,
      footprint,
    }]
  })
}

export function roomHorizontalInterfaces(rooms, storyHeight = 2.5) {
  const roomEntries = Object.entries(rooms || {})
    .map(([roomId, room]) => ({ roomId, room: { id: roomId, ...room } }))
    .sort((left, right) => left.roomId.localeCompare(right.roomId))
  const levels = new Map()
  const levelAt = y => {
    const cleanY = clean(y)
    const key = String(cleanY)
    if (!levels.has(key)) levels.set(key, { y: cleanY, floors: [], ceilings: [] })
    return levels.get(key)
  }

  for (const { roomId, room } of roomEntries) {
    const baseY = Number.isFinite(Number(room.y))
      ? Number(room.y)
      : (Number(room.level) || 0) * storyHeight
    if (room.floorEnabled !== false) {
      const floorSlice = roomSliceAtLevel(room, 0, rooms, storyHeight)
      if (floorSlice && multiPolygonArea(floorSlice.footprint) > EPSILON) {
        levelAt(baseY).floors.push({ roomId, footprint: floorSlice.footprint })
      }
    }
    if (room.ceilingEnabled !== false) {
      for (const region of roomCeilingRegions(room, rooms, storyHeight)) {
        levelAt(baseY + region.topOffset * storyHeight).ceilings.push({
          roomId,
          displayLevel: Math.round(baseY / storyHeight) + region.offset,
          footprint: region.footprint,
        })
      }
    }
  }

  const interfaces = []
  const addInterface = ({ level, footprint, floor = null, ceiling = null }) => {
    if (!footprint || multiPolygonArea(footprint) <= EPSILON) return
    interfaces.push({
      id: `horizontal:${level.y}:${floor?.roomId || '-'}:${ceiling?.roomId || '-'}`,
      y: level.y,
      footprint: cloneMultiPolygon(footprint),
      floorRoomId: floor?.roomId || null,
      ceilingRoomId: ceiling?.roomId || null,
      ceilingDisplayLevel: ceiling?.displayLevel ?? null,
    })
  }

  for (const level of [...levels.values()].sort((left, right) => left.y - right.y)) {
    const floorFootprints = level.floors.map(item => item.footprint)
    const ceilingFootprints = level.ceilings.map(item => item.footprint)
    for (const floor of level.floors) {
      for (const ceiling of level.ceilings) {
        addInterface({
          level,
          floor,
          ceiling,
          footprint: polygonClipping.intersection(floor.footprint, ceiling.footprint),
        })
      }
      addInterface({
        level,
        floor,
        footprint: ceilingFootprints.length > 0
          ? polygonClipping.difference(floor.footprint, ...ceilingFootprints)
          : floor.footprint,
      })
    }
    for (const ceiling of level.ceilings) {
      addInterface({
        level,
        ceiling,
        footprint: floorFootprints.length > 0
          ? polygonClipping.difference(ceiling.footprint, ...floorFootprints)
          : ceiling.footprint,
      })
    }
  }
  return interfaces
}

export function multiPolygonGridCells(multiPolygon) {
  const contours = multiPolygonToContours(multiPolygon)
  if (contours.length === 0) return []
  const xs = contours.flatMap(contour => contour.points.map(value => value.x))
  const zs = contours.flatMap(contour => contour.points.map(value => value.z))
  const minX = Math.floor(Math.min(...xs))
  const maxX = Math.ceil(Math.max(...xs)) - 1
  const minZ = Math.floor(Math.min(...zs))
  const maxZ = Math.ceil(Math.max(...zs)) - 1
  const cells = []
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (multiPolygonContainsPoint(multiPolygon, point(x + 0.5, z + 0.5))) cells.push({ x, z })
    }
  }
  return cells
}

export function buildMergedRoomVerticalProfile({
  mergedRoom,
  sourceRooms,
  roomLookup = {},
  storyHeight = 2.5,
} = {}) {
  const sources = (sourceRooms || []).filter(Boolean)
  if (!mergedRoom || sources.length === 0) return null
  const sourceSlices = sources.map(room => roomVerticalSlices(room, roomLookup, storyHeight))
  const maximum = Math.max(1, ...sources.map(room => roomMaximumHeightLevels(room, storyHeight)))
  const mergedGeometryRoom = { ...mergedRoom, verticalProfile: null }
  const mergedFootprint = roomBoundaryMultiPolygon(mergedGeometryRoom, roomLookup)
  const mergedPaths = roomBoundaryPaths(mergedGeometryRoom, roomLookup)
  const slices = []

  for (let offset = 0; offset < maximum; offset += 1) {
    const active = sourceSlices.map(items => items.find(slice => slice.offset === offset)).filter(Boolean)
    // A room volume is continuous from its floor. If legacy/transient input
    // contains a vertical gap, stop at the last stable slice rather than emit a
    // non-canonical profile whose offsets and heightLevels cannot be saved.
    if (active.length === 0) break
    const footprint = active.length === 1
      ? cloneMultiPolygon(active[0].footprint)
      : polygonClipping.union(...active.map(slice => slice.footprint))
    const wallPaths = multiPolygonsHaveSameArea(footprint, mergedFootprint)
      ? mergedPaths.map(path => ({ ...path }))
      : active.length === 1
        ? active[0].wallPaths.map(path => ({ ...path }))
        : straightPathsFromMultiPolygon(footprint)
    slices.push({ offset, footprint: cloneMultiPolygon(footprint), wallPaths })
  }

  return slices.length > 0 ? { slices } : null
}
