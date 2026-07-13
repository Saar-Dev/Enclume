// shared/world/worldCompiler.js
// Compilateur pur surface_data -> WorldSnapshot. Il traduit la géométrie logique en supports,
// barrières à canaux indépendants, colliders, occluders, traversées et compartiments.

import { createWorldSnapshot } from './worldContracts.js'
import {
  deterministicWorldId,
  prepareSurfaceData,
  SURFACE_STORY_HEIGHT_DEFAULT,
} from './surfaceDocument.js'

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

function roomBounds(room) {
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
    const area = roomBounds(room)
    const y = roomBaseY(room, surface.storyHeight)
    for (let x = area.minX; x <= area.maxX; x++) {
      for (let z = area.minZ; z <= area.maxZ; z++) {
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
  }
  return entries
}

function roomCeilingEntries(surface, battlemapId) {
  const entries = new Map(Object.entries(surface.ceilings))
  for (const [roomLegacyId, room] of Object.entries(surface.rooms)) {
    if (room.ceilingEnabled === false) continue
    const area = roomBounds(room)
    const baseY = roomBaseY(room, surface.storyHeight)
    const y = baseY + roomHeightLevels(room, surface.storyHeight) * surface.storyHeight
    for (let x = area.minX; x <= area.maxX; x++) {
      for (let z = area.minZ; z <= area.maxZ; z++) {
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
  }
  return entries
}

function wallKey(wall) {
  const values = wall.axis === 'x'
    ? [wall.axis, Math.min(wall.x0, wall.x1), Math.max(wall.x0, wall.x1), wall.z0, wall.y, wall.height]
    : [wall.axis, wall.x0, Math.min(wall.z0, wall.z1), Math.max(wall.z0, wall.z1), wall.y, wall.height]
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
    const area = roomBounds(room)
    const baseY = roomBaseY(room, surface.storyHeight)
    const levels = roomHeightLevels(room, surface.storyHeight)
    const thickness = positive(room.wallThickness, 1) / surface.fine
    for (let offset = 0; offset < levels; offset++) {
      const y = baseY + offset * surface.storyHeight
      for (let x = area.minX; x <= area.maxX; x++) {
        addWallCandidate(walls, {
          ...room,
          axis: 'x', x0: x, x1: x + 1, z0: area.minZ, z1: area.minZ,
          y, height: surface.storyHeight, thickness, sourceWorldIds: [room.worldId],
        }, battlemapId)
        addWallCandidate(walls, {
          ...room,
          axis: 'x', x0: x, x1: x + 1, z0: area.maxZ + 1, z1: area.maxZ + 1,
          y, height: surface.storyHeight, thickness, sourceWorldIds: [room.worldId],
        }, battlemapId)
      }
      for (let z = area.minZ; z <= area.maxZ; z++) {
        addWallCandidate(walls, {
          ...room,
          axis: 'z', x0: area.minX, x1: area.minX, z0: z, z1: z + 1,
          y, height: surface.storyHeight, thickness, sourceWorldIds: [room.worldId],
        }, battlemapId)
        addWallCandidate(walls, {
          ...room,
          axis: 'z', x0: area.maxX + 1, x1: area.maxX + 1, z0: z, z1: z + 1,
          y, height: surface.storyHeight, thickness, sourceWorldIds: [room.worldId],
        }, battlemapId)
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
  return bounds(piece.line - half, piece.bottom, piece.alongMin, piece.line + half, piece.top, piece.alongMax)
}

function addBarrierOutputs(spatial, barrier) {
  spatial.barriers.push(barrier)
  if (barrier.blocks.movement) {
    spatial.colliders.push({
      id: `collider:${barrier.id}`,
      sourceId: barrier.sourceId,
      kind: barrier.kind,
      bounds: barrier.bounds,
    })
  }
  if (barrier.blocks.sight) {
    spatial.occluders.push({
      id: `occluder:${barrier.id}`,
      sourceId: barrier.sourceId,
      kind: barrier.kind,
      bounds: barrier.bounds,
      opacity: 1,
    })
  }
}

function addSlabs(surface, battlemapId, spatial) {
  for (const [legacyId, floor] of roomFloorEntries(surface, battlemapId)) {
    const parsed = parseFloor(legacyId, floor)
    const thickness = positive(floor.thickness, 0.25)
    const slabBounds = bounds(
      parsed.x, parsed.y - thickness / 2, parsed.z,
      parsed.x + 1, parsed.y + thickness / 2, parsed.z + 1,
    )
    const sourceId = floor.worldId
    spatial.supports.push({
      id: `support:${sourceId}`,
      sourceId,
      kind: floor.kind || 'floor',
      bounds: slabBounds,
      y: clean(parsed.y + thickness / 2),
      walkable: floor.walkable !== false,
      movementMultiplier: movementMultiplier(floor),
    })
    addBarrierOutputs(spatial, {
      id: `barrier:floor:${sourceId}`,
      sourceId,
      kind: 'floor',
      axis: 'horizontal',
      bounds: slabBounds,
      blocks: blockingChannels(floor),
    })
  }

  for (const [legacyId, ceiling] of roomCeilingEntries(surface, battlemapId)) {
    const parsed = parseCeiling(legacyId, ceiling)
    const thickness = positive(ceiling.thickness, 0.25)
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
      ? point(startAlong, number(stair.y), centerCross)
      : point(centerCross, number(stair.y), startAlong)
    const to = stair.axis === 'x'
      ? point(endAlong, number(stair.topY), centerCross)
      : point(centerCross, number(stair.topY), endAlong)
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
    if (connector.type !== 'elevator') continue
    const state = runtimeStates[connector.worldId]?.state || connector.state || 'ready'
    const x = number(connector.x) + positive(connector.width, 1) / 2
    const z = number(connector.z) + positive(connector.depth, 1) / 2
    spatial.traversals.push({
      id: `traversal:elevator:${connector.worldId}`,
      sourceId: connector.worldId,
      kind: 'elevator',
      mode: 'elevator',
      from: point(x, number(connector.fromLevel) * surface.storyHeight, z),
      to: point(x, number(connector.toLevel) * surface.storyHeight, z),
      enabled: false,
      state,
      requiresRuntimeController: true,
      allowPartial: false,
      movementMultiplier: movementMultiplier(connector),
    })
  }
}

function addCompartments(surface, spatial) {
  for (const room of Object.values(surface.rooms)) {
    const area = roomBounds(room)
    const baseY = roomBaseY(room, surface.storyHeight)
    const topY = baseY + roomHeightLevels(room, surface.storyHeight) * surface.storyHeight
    spatial.compartments.push({
      id: `compartment:${room.worldId}`,
      sourceId: room.worldId,
      kind: 'room',
      bounds: bounds(area.minX, baseY, area.minZ, area.maxX + 1, topY, area.maxZ + 1),
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

  addSlabs(surface, battlemapId, spatial)
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
