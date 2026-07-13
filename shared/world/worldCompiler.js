// shared/world/worldCompiler.js
// Compilateur pur surface_data -> WorldSnapshot. Il traduit la géométrie logique en supports,
// barrières à canaux indépendants, colliders, occluders, traversées et compartiments.

import { createWorldSnapshot } from './worldContracts.js'
import {
  deterministicWorldId,
  prepareSurfaceData,
  SURFACE_STORY_HEIGHT_DEFAULT,
} from './surfaceDocument.js'
import {
  createInitialElevatorState,
  normalizeElevatorDefinition,
  normalizeElevatorState,
} from './elevatorRuntime.js'
import {
  roomBoundarySegments,
  roomEffectiveGridCells,
  roomGeometryBounds,
} from './roomGeometry.js'

const EPSILON = 1e-6

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function positive(value, fallback = 1) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function clean(value) {
  const rounded = Math.round(value * 1e9) / 1e9
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

function movementMultiplier(item) {
  return positive(item?.movementMultiplier ?? item?.movementCostMultiplier, 1)
}

function blockingChannels(item, fallbackType = 'solid') {
  const type = item?.barrierType || fallbackType
  const transparent = type === 'glass' || type === 'grate' || type === 'open-door'
  const grate = type === 'grate'
  return {
    movement: item?.blocksMovement ?? type !== 'open-door',
    sight: item?.blocksSight ?? !transparent,
    water: item?.blocksWater ?? (!grate && type !== 'open-door'),
    gas: item?.blocksGas ?? item?.blocksWater ?? (!grate && type !== 'open-door'),
  }
}

function parseFloor(id, floor) {
  const [keyX, keyZ, keyY = 0] = String(id).split(':')
  return {
    x: number(floor.x ?? keyX),
    z: number(floor.z ?? keyZ),
    y: number(floor.y ?? keyY),
  }
}

function parseCeiling(id, ceiling) {
  const [keyX, keyZ, keyBaseY = 0, keyY = SURFACE_STORY_HEIGHT_DEFAULT] = String(id).split(':')
  return {
    x: number(ceiling.x ?? keyX),
    z: number(ceiling.z ?? keyZ),
    baseY: number(ceiling.baseY ?? keyBaseY),
    y: number(ceiling.y ?? keyY, SURFACE_STORY_HEIGHT_DEFAULT),
  }
}

function rawRoomBounds(room) {
  const minX = Math.trunc(number(room.minX))
  const maxX = Math.trunc(number(room.maxX, minX))
  const minZ = Math.trunc(number(room.minZ))
  const maxZ = Math.trunc(number(room.maxZ, minZ))
  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minZ: Math.min(minZ, maxZ),
    maxZ: Math.max(minZ, maxZ),
  }
}

function roomCellKey(x, z) {
  return `${Math.trunc(number(x))}:${Math.trunc(number(z))}`
}

function roomBounds(room, roomLookup = {}) {
  return roomGeometryBounds(room, roomLookup) || rawRoomBounds(room)
}

function roomBaseY(room, storyHeight) {
  return Number.isFinite(Number(room.y)) ? Number(room.y) : number(room.level) * storyHeight
}

function roomHeightLevels(room, storyHeight) {
  return Math.max(1, Math.trunc(number(
    room.heightLevels,
    Math.round(positive(room.height, storyHeight) / storyHeight),
  )))
}

function roomFloorEntries(surface, battlemapId) {
  const entries = new Map(Object.entries(surface.floors))
  for (const [roomLegacyId, room] of Object.entries(surface.rooms)) {
    if (room.floorEnabled === false) continue
    const cells = roomEffectiveGridCells({ id: roomLegacyId, ...room }, surface.rooms)
    const y = roomBaseY(room, surface.storyHeight)
    for (const { x, z } of cells) {
        const key = `${x}:${z}:${y}`
        if (entries.has(key)) continue
        entries.set(key, {
          worldId: deterministicWorldId(battlemapId, 'room-floor', `${roomLegacyId}:${key}`),
          x,
          z,
          y,
          thickness: positive(room.floorThickness, 0.25),
          walkable: true,
          movementMultiplier: movementMultiplier(room),
          barrierType: room.barrierType,
          blocksMovement: room.blocksMovement,
          blocksSight: room.blocksSight,
          blocksWater: room.blocksWater,
          sourceRoomWorldId: room.worldId,
        })
    }
  }
  return entries
}

function roomCeilingEntries(surface, battlemapId) {
  const entries = new Map(Object.entries(surface.ceilings))
  for (const [roomLegacyId, room] of Object.entries(surface.rooms)) {
    if (room.ceilingEnabled === false) continue
    const cells = roomEffectiveGridCells({ id: roomLegacyId, ...room }, surface.rooms)
    const baseY = roomBaseY(room, surface.storyHeight)
    const y = baseY + roomHeightLevels(room, surface.storyHeight) * surface.storyHeight
    for (const { x, z } of cells) {
        const key = `${x}:${z}:${baseY}:${y}`
        if (entries.has(key)) continue
        entries.set(key, {
          worldId: deterministicWorldId(battlemapId, 'room-ceiling', `${roomLegacyId}:${key}`),
          x,
          z,
          baseY,
          y,
          thickness: positive(room.ceilingThickness, positive(room.floorThickness, 0.25)),
          barrierType: room.barrierType,
          blocksMovement: room.blocksMovement,
          blocksSight: room.blocksSight,
          blocksWater: room.blocksWater,
          sourceRoomWorldId: room.worldId,
        })
    }
  }
  return entries
}

function wallKey(wall) {
  const values = wall.axis === 'x'
    ? [wall.axis, Math.min(wall.x0, wall.x1), Math.max(wall.x0, wall.x1), wall.z0, wall.y, wall.height]
    : wall.axis === 'z'
      ? [wall.axis, wall.x0, Math.min(wall.z0, wall.z1), Math.max(wall.z0, wall.z1), wall.y, wall.height]
      : (() => {
          const start = `${clean(wall.x0)}:${clean(wall.z0)}`
          const end = `${clean(wall.x1)}:${clean(wall.z1)}`
          return start.localeCompare(end) <= 0
            ? [wall.axis, wall.x0, wall.z0, wall.x1, wall.z1, wall.y, wall.height]
            : [wall.axis, wall.x1, wall.z1, wall.x0, wall.z0, wall.y, wall.height]
        })()
  return values.map(value => typeof value === 'number' ? clean(value) : value).join(':')
}

function addWallCandidate(map, candidate, battlemapId) {
  const key = wallKey(candidate)
  const existing = map.get(key)
  if (!existing) {
    map.set(key, {
      ...candidate,
      worldId: deterministicWorldId(battlemapId, 'compiled-wall', key),
      sourceWorldIds: [...new Set(candidate.sourceWorldIds || [])],
      blocks: blockingChannels(candidate),
    })
    return
  }
  existing.sourceWorldIds = [...new Set([...existing.sourceWorldIds, ...(candidate.sourceWorldIds || [])])]
  const nextBlocks = blockingChannels(candidate)
  for (const channel of Object.keys(existing.blocks)) {
    existing.blocks[channel] = existing.blocks[channel] || nextBlocks[channel]
  }
  existing.thickness = Math.max(existing.thickness, candidate.thickness)
}

function roomWallCandidates(surface, battlemapId) {
  const walls = new Map()
  for (const room of Object.values(surface.rooms)) {
    if (room.wallEnabled === false) continue
    const baseY = roomBaseY(room, surface.storyHeight)
    const levels = roomHeightLevels(room, surface.storyHeight)
    const thickness = positive(room.wallThickness, 1) / surface.fine
    const boundary = roomBoundarySegments(room, surface.rooms)
    for (let offset = 0; offset < levels; offset++) {
      const y = baseY + offset * surface.storyHeight
      for (const segment of boundary) {
        const addBoundary = wall => addWallCandidate(walls, {
          ...room,
          ...wall,
          y,
          height: surface.storyHeight,
          thickness,
          sourceWorldIds: [room.worldId],
        }, battlemapId)
        addBoundary(segment)
      }
    }
  }
  for (const wall of Object.values(surface.walls)) {
    addWallCandidate(walls, {
      ...wall,
      x0: number(wall.x0) / surface.fine,
      x1: number(wall.x1) / surface.fine,
      z0: number(wall.z0) / surface.fine,
      z1: number(wall.z1) / surface.fine,
      y: number(wall.y),
      height: positive(wall.height, surface.storyHeight),
      thickness: positive(wall.thickness, 1) / surface.fine,
      sourceWorldIds: [wall.worldId],
    }, battlemapId)
  }
  return [...walls.values()]
}

function wallPieceFromCandidate(wall) {
  if (wall.axis === 'segment') {
    return {
      ...wall,
      bottom: wall.y,
      top: wall.y + wall.height,
      suffix: 'full',
    }
  }
  return {
    ...wall,
    alongMin: wall.axis === 'x' ? Math.min(wall.x0, wall.x1) : Math.min(wall.z0, wall.z1),
    alongMax: wall.axis === 'x' ? Math.max(wall.x0, wall.x1) : Math.max(wall.z0, wall.z1),
    line: wall.axis === 'x' ? wall.z0 : wall.x0,
    bottom: wall.y,
    top: wall.y + wall.height,
    suffix: 'full',
  }
}

function doorGeometry(connector, surface, runtimeState) {
  const axis = connector.axis
  const alongStart = axis === 'x' ? number(connector.x0) : number(connector.z0)
  const alongEnd = axis === 'x' ? number(connector.x1) : number(connector.z1)
  const centerFine = Number.isFinite(Number(connector.alongCenter))
    ? Number(connector.alongCenter)
    : (alongStart + alongEnd) / 2
  const geometry = connector.modelGeometry || {}
  const explicitOpening = number(geometry.openingWidth || geometry.doorPanelWidth || geometry.door_panel_width_m)
  const explicitCut = number(geometry.wallCutWidth || geometry.footprintWidth || geometry.footprint_width_m)
  const storedWidth = Math.abs(alongEnd - alongStart) / surface.fine
  const cutWidth = positive(explicitCut, positive(storedWidth, positive(connector.width, positive(geometry.width, 1))))
  const openingWidth = positive(explicitOpening, Math.max(0.25, cutWidth - 0.02))
  const center = centerFine / surface.fine
  const state = runtimeState?.state || connector.state || 'closed'
  const line = (axis === 'x' ? number(connector.z0) : number(connector.x0)) / surface.fine
  const bottom = number(connector.y)
  const height = positive(geometry.height, positive(connector.height, 2))
  const thickness = Math.max(
    positive(connector.thickness, 1) / surface.fine,
    positive(connector.depth, 0.25),
  )
  return {
    connector,
    worldId: connector.worldId,
    axis,
    line,
    alongMin: center - openingWidth / 2,
    alongMax: center + openingWidth / 2,
    cutAlongMin: center - cutWidth / 2,
    cutAlongMax: center + cutWidth / 2,
    bottom,
    top: bottom + height,
    thickness,
    state,
  }
}

function doorMatchesWall(door, wall) {
  return door.axis === wall.axis
    && Math.abs(door.line - wall.line) <= EPSILON
    && door.top > wall.bottom + EPSILON
    && door.bottom < wall.top - EPSILON
    && door.cutAlongMax > wall.alongMin + EPSILON
    && door.cutAlongMin < wall.alongMax - EPSILON
}

function splitWallPiece(piece, door) {
  if (!doorMatchesWall(door, piece)) return [piece]
  const openingMin = Math.max(piece.alongMin, door.cutAlongMin)
  const openingMax = Math.min(piece.alongMax, door.cutAlongMax)
  const openingBottom = Math.max(piece.bottom, door.bottom)
  const openingTop = Math.min(piece.top, door.top)
  if (openingMax <= openingMin + EPSILON || openingTop <= openingBottom + EPSILON) return [piece]

  const parts = []
  const push = (suffix, alongMin, alongMax, bottom, top) => {
    if (alongMax <= alongMin + EPSILON || top <= bottom + EPSILON) return
    parts.push({ ...piece, suffix: `${piece.suffix}:${suffix}`, alongMin, alongMax, bottom, top })
  }
  push('before', piece.alongMin, openingMin, piece.bottom, piece.top)
  push('after', openingMax, piece.alongMax, piece.bottom, piece.top)
  push('below', openingMin, openingMax, piece.bottom, openingBottom)
  push('above', openingMin, openingMax, openingTop, piece.top)
  return parts
}

function wallPieceBounds(piece) {
  const half = piece.thickness / 2
  if (piece.axis === 'x') {
    return bounds(piece.alongMin, piece.bottom, piece.line - half, piece.alongMax, piece.top, piece.line + half)
  }
  if (piece.axis === 'segment') {
    return bounds(
      Math.min(piece.x0, piece.x1) - half,
      piece.bottom,
      Math.min(piece.z0, piece.z1) - half,
      Math.max(piece.x0, piece.x1) + half,
      piece.top,
      Math.max(piece.z0, piece.z1) + half,
    )
  }
  return bounds(piece.line - half, piece.bottom, piece.alongMin, piece.line + half, piece.top, piece.alongMax)
}

function wallPieceGeometry(piece) {
  if (piece.axis !== 'segment') return null
  return {
    type: 'wall-segment',
    from: { x: clean(piece.x0), z: clean(piece.z0) },
    to: { x: clean(piece.x1), z: clean(piece.z1) },
    minY: clean(piece.bottom),
    maxY: clean(piece.top),
    thickness: clean(piece.thickness),
  }
}

function addBarrierOutputs(spatial, barrier) {
  spatial.barriers.push(barrier)
  if (barrier.blocks.movement) {
    spatial.colliders.push({
      id: `collider:${barrier.id}`,
      sourceId: barrier.sourceId,
      kind: barrier.kind,
      bounds: barrier.bounds,
      ...(barrier.geometry ? { geometry: barrier.geometry } : {}),
    })
  }
  if (barrier.blocks.sight) {
    spatial.occluders.push({
      id: `occluder:${barrier.id}`,
      sourceId: barrier.sourceId,
      kind: barrier.kind,
      bounds: barrier.bounds,
      ...(barrier.geometry ? { geometry: barrier.geometry } : {}),
      opacity: 1,
    })
  }
}

function surfaceElevators(surface) {
  return Object.values(surface.connectors)
    .filter(connector => connector.type === 'elevator')
    .map(connector => normalizeElevatorDefinition(connector, { storyHeight: surface.storyHeight }))
}

function slabIsInsideElevatorShaft(elevators, slab, topY) {
  return elevators.some(elevator => {
    const centerX = slab.x + 0.5
    const centerZ = slab.z + 0.5
    const minY = elevator.stops[0].y - elevator.floorThickness
    const maxY = elevator.stops.at(-1).y + elevator.cabinHeight
    return centerX > elevator.x - EPSILON && centerX < elevator.x + elevator.width + EPSILON
      && centerZ > elevator.z - EPSILON && centerZ < elevator.z + elevator.depth + EPSILON
      && topY >= minY - EPSILON && topY <= maxY + EPSILON
  })
}

function addSlabs(surface, runtimeStates, battlemapId, spatial) {
  const elevators = surfaceElevators(surface)
  for (const [legacyId, floor] of roomFloorEntries(surface, battlemapId)) {
    const parsed = parseFloor(legacyId, floor)
    const thickness = positive(floor.thickness, 0.25)
    if (slabIsInsideElevatorShaft(elevators, parsed, parsed.y + thickness / 2)) continue
    const slabBounds = bounds(
      parsed.x, parsed.y - thickness / 2, parsed.z,
      parsed.x + 1, parsed.y + thickness / 2, parsed.z + 1,
    )
    const sourceId = floor.worldId
    const runtime = runtimeStates[sourceId]
    if (floor.runtimeSupport && (runtime?.enabled === false || runtime?.state === 'destroyed')) continue
    const kind = floor.kind || 'floor'
    spatial.supports.push({
      id: `support:${sourceId}`,
      sourceId,
      kind,
      bounds: slabBounds,
      y: clean(parsed.y + thickness / 2),
      walkable: floor.walkable !== false,
      movementMultiplier: movementMultiplier(floor),
    })
    addBarrierOutputs(spatial, {
      id: `barrier:floor:${sourceId}`,
      sourceId,
      kind,
      axis: 'horizontal',
      bounds: slabBounds,
      blocks: blockingChannels(floor),
    })
  }

  for (const [legacyId, ceiling] of roomCeilingEntries(surface, battlemapId)) {
    const parsed = parseCeiling(legacyId, ceiling)
    const thickness = positive(ceiling.thickness, 0.25)
    if (slabIsInsideElevatorShaft(elevators, parsed, parsed.y + thickness / 2)) continue
    addBarrierOutputs(spatial, {
      id: `barrier:ceiling:${ceiling.worldId}`,
      sourceId: ceiling.worldId,
      kind: 'ceiling',
      axis: 'horizontal',
      bounds: bounds(
        parsed.x, parsed.y - thickness / 2, parsed.z,
        parsed.x + 1, parsed.y + thickness / 2, parsed.z + 1,
      ),
      blocks: blockingChannels(ceiling),
    })
  }
}

function addWallsAndDoors(surface, runtimeStates, battlemapId, spatial, worldDocument) {
  const doors = Object.values(surface.connectors)
    .filter(connector => connector.type === 'door')
    .map(connector => doorGeometry(connector, surface, runtimeStates[connector.worldId]))
    .sort((a, b) => a.alongMin - b.alongMin || a.worldId.localeCompare(b.worldId))

  for (const wall of roomWallCandidates(surface, battlemapId)) {
    let pieces = [wallPieceFromCandidate(wall)]
    for (const door of doors) pieces = pieces.flatMap(piece => splitWallPiece(piece, door))
    for (const piece of pieces) {
      addBarrierOutputs(spatial, {
        id: `barrier:wall:${wall.worldId}:${piece.suffix}`,
        sourceId: wall.worldId,
        sourceIds: wall.sourceWorldIds,
        kind: 'wall',
        axis: wall.axis,
        bounds: wallPieceBounds(piece),
        geometry: wallPieceGeometry(piece),
        blocks: wall.blocks,
      })
    }
  }

  const roomWorldIds = new Map(Object.entries(surface.rooms).map(([legacyId, room]) => [legacyId, room.worldId]))
  for (const door of doors) {
    const connector = door.connector
    const isOpen = door.state === 'open'
    const blocks = isOpen
      ? { movement: false, sight: false, water: false, gas: false }
      : blockingChannels(connector, 'door')
    const half = door.thickness / 2
    const doorBounds = door.axis === 'x'
      ? bounds(door.alongMin, door.bottom, door.line - half, door.alongMax, door.top, door.line + half)
      : bounds(door.line - half, door.bottom, door.alongMin, door.line + half, door.top, door.alongMax)
    addBarrierOutputs(spatial, {
      id: `barrier:door:${door.worldId}`,
      sourceId: door.worldId,
      kind: 'door',
      axis: door.axis,
      state: door.state,
      bounds: doorBounds,
      blocks,
    })

    const center = (door.alongMin + door.alongMax) / 2
    const feetY = door.bottom
    const margin = half + 0.05
    const from = door.axis === 'x'
      ? point(center, feetY, door.line - margin)
      : point(door.line - margin, feetY, center)
    const to = door.axis === 'x'
      ? point(center, feetY, door.line + margin)
      : point(door.line + margin, feetY, center)
    spatial.traversals.push({
      id: `traversal:door:${door.worldId}`,
      sourceId: door.worldId,
      kind: 'door',
      mode: 'walk',
      from,
      to,
      enabled: isOpen,
      allowPartial: true,
      movementMultiplier: movementMultiplier(connector),
      roomIds: (connector.roomIds || []).map(id => roomWorldIds.get(id)).filter(Boolean),
    })
  }

  // La référence au document évite qu'un compilateur futur dérive une deuxième identité.
  void worldDocument
}

function addVerticalTraversals(surface, runtimeStates, spatial) {
  for (const stair of Object.values(surface.stairs)) {
    const supportOffset = positive(stair.supportThickness, 0.25) / 2
    const centerCross = stair.axis === 'x'
      ? (number(stair.minZ) + number(stair.maxZ) + 1) / 2
      : (number(stair.minX) + number(stair.maxX) + 1) / 2
    const startAlong = stair.axis === 'x'
      ? (number(stair.dir, 1) >= 0 ? number(stair.minX) : number(stair.maxX) + 1)
      : (number(stair.dir, 1) >= 0 ? number(stair.minZ) : number(stair.maxZ) + 1)
    const endAlong = stair.axis === 'x'
      ? (number(stair.dir, 1) >= 0 ? number(stair.maxX) + 1 : number(stair.minX))
      : (number(stair.dir, 1) >= 0 ? number(stair.maxZ) + 1 : number(stair.minZ))
    const from = stair.axis === 'x'
      ? point(startAlong, number(stair.y) + supportOffset, centerCross)
      : point(centerCross, number(stair.y) + supportOffset, startAlong)
    const to = stair.axis === 'x'
      ? point(endAlong, number(stair.topY) + supportOffset, centerCross)
      : point(centerCross, number(stair.topY) + supportOffset, endAlong)
    spatial.traversals.push({
      id: `traversal:stairs:${stair.worldId}`,
      sourceId: stair.worldId,
      kind: 'stairs',
      mode: 'stairs',
      from,
      to,
      enabled: runtimeStates[stair.worldId]?.enabled !== false,
      allowPartial: true,
      movementMultiplier: movementMultiplier(stair),
    })
    spatial.supports.push({
      id: `support:stairs:${stair.worldId}`,
      sourceId: stair.worldId,
      kind: 'stairs',
      bounds: bounds(
        number(stair.minX), Math.min(number(stair.y), number(stair.topY)), number(stair.minZ),
        number(stair.maxX) + 1, Math.max(number(stair.y), number(stair.topY)), number(stair.maxZ) + 1,
      ),
      from,
      to,
      walkable: stair.walkable !== false,
      movementMultiplier: movementMultiplier(stair),
    })
  }

  for (const connector of Object.values(surface.connectors)) {
    if (connector.type === 'ladder') {
      const state = runtimeStates[connector.worldId]
      const center = point(number(connector.x) + 0.5, 0, number(connector.z) + 0.5)
      spatial.traversals.push({
        id: `traversal:ladder:${connector.worldId}`,
        sourceId: connector.worldId,
        kind: 'ladder',
        mode: 'climb',
        from: point(center.x, number(connector.fromY, connector.y), center.z),
        to: point(center.x, number(connector.toY, connector.topY), center.z),
        enabled: state?.enabled !== false && state?.state !== 'destroyed',
        allowPartial: true,
        movementMultiplier: movementMultiplier(connector),
        anchorSpacing: positive(connector.anchorSpacing, 0.5),
      })
      continue
    }
    if (connector.type !== 'elevator') continue
    const definition = normalizeElevatorDefinition(connector, { storyHeight: surface.storyHeight })
    const initial = createInitialElevatorState(definition, {
      initialStopId: `level:${number(connector.fromLevel, definition.stops[0].level)}`,
    })
    const state = normalizeElevatorState(definition, runtimeStates[connector.worldId] || initial)
    const floorY = state.positionY
    const floorBottom = floorY - definition.floorThickness
    const cabinTop = floorY + definition.cabinHeight
    const centerX = definition.x + definition.width / 2
    const centerZ = definition.z + definition.depth / 2
    const currentStop = definition.stops.find(stop => stop.id === state.currentStopId)
    const aligned = currentStop && Math.abs(currentStop.y - floorY) <= EPSILON
    const doorsOpen = state.phase === 'open' && state.doorState === 'open' && aligned
    const cabinBounds = bounds(
      definition.x, floorBottom, definition.z,
      definition.x + definition.width, cabinTop, definition.z + definition.depth,
    )

    spatial.supports.push({
      id: `support:elevator-cabin:${connector.worldId}`,
      sourceId: connector.worldId,
      kind: 'elevator-cabin',
      bounds: bounds(
        definition.x, floorBottom, definition.z,
        definition.x + definition.width, floorY, definition.z + definition.depth,
      ),
      y: clean(floorY),
      walkable: true,
      mobile: true,
      movementMultiplier: movementMultiplier(connector),
    })
    addBarrierOutputs(spatial, {
      id: `barrier:elevator-cabin-floor:${connector.worldId}`,
      sourceId: connector.worldId,
      kind: 'elevator-cabin-floor',
      axis: 'horizontal',
      bounds: bounds(
        definition.x, floorBottom, definition.z,
        definition.x + definition.width, floorY, definition.z + definition.depth,
      ),
      blocks: { movement: true, sight: false, water: true, gas: true },
    })
    addBarrierOutputs(spatial, {
      id: `barrier:elevator-cabin-ceiling:${connector.worldId}`,
      sourceId: connector.worldId,
      kind: 'elevator-cabin-ceiling',
      axis: 'horizontal',
      bounds: bounds(
        definition.x, cabinTop - definition.floorThickness, definition.z,
        definition.x + definition.width, cabinTop, definition.z + definition.depth,
      ),
      blocks: { movement: true, sight: true, water: true, gas: true },
    })

    const wallFaces = [
      { axis: 'x', side: -1, line: definition.x },
      { axis: 'x', side: 1, line: definition.x + definition.width },
      { axis: 'z', side: -1, line: definition.z },
      { axis: 'z', side: 1, line: definition.z + definition.depth },
    ]
    for (const face of wallFaces) {
      const isDoorFace = face.axis === definition.doorAxis && face.side === definition.doorSide
      if (isDoorFace && doorsOpen) continue
      const half = definition.wallThickness / 2
      addBarrierOutputs(spatial, {
        id: `barrier:elevator-cabin-wall:${connector.worldId}:${face.axis}:${face.side}`,
        sourceId: connector.worldId,
        kind: isDoorFace ? 'elevator-cabin-door' : 'elevator-cabin-wall',
        axis: face.axis,
        bounds: face.axis === 'x'
          ? bounds(face.line - half, floorY, definition.z, face.line + half, cabinTop, definition.z + definition.depth)
          : bounds(definition.x, floorY, face.line - half, definition.x + definition.width, cabinTop, face.line + half),
        blocks: { movement: true, sight: true, water: true, gas: true },
      })
    }

    const shaftBottom = definition.stops[0].y
    const shaftTop = definition.stops.at(-1).y + definition.cabinHeight
    for (const face of wallFaces) {
      if (face.axis === definition.doorAxis && face.side === definition.doorSide) continue
      const half = definition.wallThickness / 2
      addBarrierOutputs(spatial, {
        id: `barrier:elevator-shaft:${connector.worldId}:${face.axis}:${face.side}`,
        sourceId: connector.worldId,
        kind: 'elevator-shaft',
        axis: face.axis,
        bounds: face.axis === 'x'
          ? bounds(face.line - half, shaftBottom, definition.z, face.line + half, shaftTop, definition.z + definition.depth)
          : bounds(definition.x, shaftBottom, face.line - half, definition.x + definition.width, shaftTop, face.line + half),
        blocks: { movement: true, sight: true, water: true, gas: true },
      })
    }

    for (const stop of definition.stops) {
      const landingOpen = doorsOpen && stop.id === state.currentStopId
      if (landingOpen) continue
      const half = definition.wallThickness / 2
      const line = definition.doorAxis === 'x'
        ? (definition.doorSide < 0 ? definition.x : definition.x + definition.width)
        : (definition.doorSide < 0 ? definition.z : definition.z + definition.depth)
      addBarrierOutputs(spatial, {
        id: `barrier:elevator-landing-door:${connector.worldId}:${stop.id}`,
        sourceId: connector.worldId,
        kind: 'elevator-landing-door',
        axis: definition.doorAxis,
        stopId: stop.id,
        bounds: definition.doorAxis === 'x'
          ? bounds(line - half, stop.y, definition.z, line + half, stop.y + definition.cabinHeight, definition.z + definition.depth)
          : bounds(definition.x, stop.y, line - half, definition.x + definition.width, stop.y + definition.cabinHeight, line + half),
        blocks: { movement: true, sight: true, water: true, gas: true },
      })
    }

    if (doorsOpen) {
      const landing = definition.doorAxis === 'x'
        ? point(centerX + definition.doorSide * definition.width, floorY, centerZ)
        : point(centerX, floorY, centerZ + definition.doorSide * definition.depth)
      spatial.traversals.push({
        id: `traversal:elevator-boarding:${connector.worldId}:${state.currentStopId}`,
        sourceId: connector.worldId,
        kind: 'elevator-boarding',
        mode: 'walk',
        from: point(centerX, floorY, centerZ),
        to: landing,
        enabled: true,
        allowPartial: false,
        movementMultiplier: movementMultiplier(connector),
        stopId: state.currentStopId,
      })
    }

    spatial.compartments.push({
      id: `compartment:elevator-cabin:${connector.worldId}`,
      sourceId: connector.worldId,
      kind: 'elevator-cabin',
      bounds: cabinBounds,
      mobile: true,
      sealedByDefault: !doorsOpen,
    })
  }
}

function addCompartments(surface, spatial) {
  for (const [roomId, room] of Object.entries(surface.rooms)) {
    const identifiedRoom = { id: roomId, ...room }
    const area = roomBounds(identifiedRoom, surface.rooms)
    const cells = roomEffectiveGridCells(identifiedRoom, surface.rooms)
    const baseY = roomBaseY(room, surface.storyHeight)
    const topY = baseY + roomHeightLevels(room, surface.storyHeight) * surface.storyHeight
    spatial.compartments.push({
      id: `compartment:${room.worldId}`,
      sourceId: room.worldId,
      kind: 'room',
      bounds: bounds(area.minX, baseY, area.minZ, area.maxX, topY, area.maxZ),
      footprint: cells.map(cell => roomCellKey(cell.x, cell.z)),
      sealedByDefault: room.blocksWater !== false,
    })
  }
}

export function compileSurfaceWorld({
  surfaceData,
  battlemapId = null,
  worldRevision = 0,
  runtimeState = null,
} = {}) {
  const prepared = prepareSurfaceData(surfaceData, { battlemapId })
  const surface = prepared.surfaceData
  const runtimeStates = runtimeState?.featureStates || {}
  const spatial = {
    supports: [],
    barriers: [],
    traversals: [],
    colliders: [],
    occluders: [],
    compartments: [],
    regions: [],
  }

  addSlabs(surface, runtimeStates, battlemapId, spatial)
  addWallsAndDoors(surface, runtimeStates, battlemapId, spatial, prepared.worldDocument)
  addVerticalTraversals(surface, runtimeStates, spatial)
  addCompartments(surface, spatial)

  for (const collection of Object.values(spatial)) {
    collection.sort((a, b) => a.id.localeCompare(b.id))
  }

  return createWorldSnapshot({
    battlemapId,
    worldRevision,
    metrics: prepared.worldDocument.metrics,
    spatial,
  })
}
