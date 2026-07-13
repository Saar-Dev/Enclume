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

export function sampleRoomBoundaryArc(arc, density = 8) {
  const start = point(arc?.start?.x, arc?.start?.z)
  const end = point(arc?.end?.x, arc?.end?.z)
  const dx = end.x - start.x
  const dz = end.z - start.z
  const chord = Math.hypot(dx, dz)
  if (chord <= EPSILON) return [start, end]

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
  const sampleCount = Math.max(4, Math.min(128, Math.ceil(radius * angle * Math.max(2, Number(density) || 8))))
  const points = []
  for (let index = 0; index <= sampleCount; index += 1) {
    const progress = index / sampleCount
    const currentAngle = startAngle + sweep * progress
    points.push(point(
      center.x + Math.cos(currentAngle) * radius,
      center.z + Math.sin(currentAngle) * radius,
    ))
  }
  points[0] = start
  points[points.length - 1] = end
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

export function roomBoundaryContours(room) {
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

export function roomBoundarySegments(room) {
  return roomBoundaryContours(room).flatMap((contour, loopIndex) => (
    contour.points.map((from, index) => {
      const to = contour.points[(index + 1) % contour.points.length]
      const dx = to.x - from.x
      const dz = to.z - from.z
      return {
        id: `boundary:${loopIndex}:${index}:${from.x}:${from.z}:${to.x}:${to.z}`,
        loopIndex,
        index,
        axis: Math.abs(dz) <= EPSILON ? 'x' : Math.abs(dx) <= EPSILON ? 'z' : 'segment',
        x0: from.x,
        z0: from.z,
        x1: to.x,
        z1: to.z,
      }
    })
  ))
}
