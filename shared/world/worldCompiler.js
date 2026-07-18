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
  roomCeilingRegions,
  differenceMultiPolygons,
  intersectMultiPolygons,
  multiPolygonBounds,
  multiPolygonContainsPoint,
  roomEffectiveGridCells,
  roomGeometryBounds,
  roomMaximumHeightLevels,
  roomInteriorFootprintAtY,
  roomVerticalSlices,
  multiPolygonGridCells,
  wallCornerIntersectionPoint,
  withWallCornerJoins,
} from './roomGeometry.js'
import {
  stairGeometry,
  stairOpeningMultiPolygon,
} from './stairGeometry.js'

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
  return roomMaximumHeightLevels(room, storyHeight)
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
    const baseY = roomBaseY(room, surface.storyHeight)
    for (const region of roomCeilingRegions(
      { id: roomLegacyId, ...room },
      surface.rooms,
      surface.storyHeight,
    )) {
      const y = baseY + region.topOffset * surface.storyHeight
      for (const { x, z } of multiPolygonGridCells(region.footprint)) {
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
  const values = wall.axis === 'arc'
    ? [wall.axis, wall.curveId, wall.curveOffset0, wall.curveOffset1, wall.y, wall.height]
    : wall.axis === 'x'
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
    const profileFace = candidate.elevationProfileFace === 'back' ? 'back' : 'front'
    const interiorFace = candidate.interiorFace === 'back'
      ? 'back'
      : candidate.interiorFace === 'front' ? 'front' : null
    map.set(key, {
      ...candidate,
      worldId: deterministicWorldId(battlemapId, 'compiled-wall', key),
      sourceWorldIds: [...new Set(candidate.sourceWorldIds || [])],
      blocks: blockingChannels(candidate),
      frontElevationProfile: profileFace === 'front' ? candidate.elevationProfile : null,
      backElevationProfile: profileFace === 'back' ? candidate.elevationProfile : null,
      frontSourceWorldIds: interiorFace === 'front' ? [...new Set(candidate.sourceWorldIds || [])] : [],
      backSourceWorldIds: interiorFace === 'back' ? [...new Set(candidate.sourceWorldIds || [])] : [],
    })
    return
  }
  existing.sourceWorldIds = [...new Set([...existing.sourceWorldIds, ...(candidate.sourceWorldIds || [])])]
  const nextBlocks = blockingChannels(candidate)
  for (const channel of Object.keys(existing.blocks)) {
    existing.blocks[channel] = existing.blocks[channel] || nextBlocks[channel]
  }
  existing.thickness = Math.max(existing.thickness, candidate.thickness)
  const sameDirection = Math.abs(number(existing.x0) - number(candidate.x0)) <= EPSILON
    && Math.abs(number(existing.z0) - number(candidate.z0)) <= EPSILON
    && Math.abs(number(existing.x1) - number(candidate.x1)) <= EPSILON
    && Math.abs(number(existing.z1) - number(candidate.z1)) <= EPSILON
  if (candidate.interiorFace) {
    const requestedInteriorFace = candidate.interiorFace === 'back' ? 'back' : 'front'
    const interiorFace = sameDirection
      ? requestedInteriorFace
      : requestedInteriorFace === 'front' ? 'back' : 'front'
    const field = `${interiorFace}SourceWorldIds`
    existing[field] = [...new Set([...(existing[field] || []), ...(candidate.sourceWorldIds || [])])]
  }
  if (candidate.elevationProfile) {
    const requestedFace = candidate.elevationProfileFace === 'back' ? 'back' : 'front'
    const profileFace = sameDirection ? requestedFace : requestedFace === 'front' ? 'back' : 'front'
    existing[`${profileFace}ElevationProfile`] = candidate.elevationProfile
  }
}

function finalizeWallElevationProfiles(wall) {
  const ownerCount = wall.sourceWorldIds?.length || 0
  if (ownerCount <= 1) {
    const elevationProfile = wall.frontElevationProfile || wall.backElevationProfile || null
    if (!elevationProfile) return wall
    return {
      ...wall,
      elevationProfileMode: 'translated',
      elevationProfile,
      elevationProfileDirection: wall.frontElevationProfile ? 1 : -1,
    }
  }
  if (!wall.frontElevationProfile && !wall.backElevationProfile) return wall
  return { ...wall, elevationProfileMode: 'faces' }
}

function maximumWallProfileDepth(wall) {
  return Math.max(
    Math.abs(number(wall?.elevationProfile?.depth)),
    Math.abs(number(wall?.frontElevationProfile?.depth)),
    Math.abs(number(wall?.backElevationProfile?.depth)),
  )
}

function compiledElevationProfileOffset(profile, progress) {
  const type = ['curved', 'faceted'].includes(profile?.type) ? profile.type : 'vertical'
  const depth = type === 'vertical' ? 0 : Math.max(0, number(profile?.depth))
  const direction = number(profile?.direction, 1) < 0 ? -1 : 1
  const t = Math.max(0, Math.min(1, number(progress)))
  if (type === 'curved') return depth * direction * Math.sin(Math.PI * t)
  if (type === 'faceted') return depth * direction * (1 - Math.abs(t * 2 - 1))
  return 0
}

function compiledWallFaceDistances(wall, progress) {
  const half = positive(wall?.thickness, 0.1) / 2
  const minimumThickness = Math.max(0.01, half * 0.2)
  let front = half
  let back = -half
  if (wall?.elevationProfileMode === 'translated') {
    const direction = number(wall.elevationProfileDirection, 1) < 0 ? -1 : 1
    const offset = compiledElevationProfileOffset(wall.elevationProfile, progress) * direction
    front += offset
    back += offset
  } else {
    front += compiledElevationProfileOffset(wall?.frontElevationProfile, progress)
    back -= compiledElevationProfileOffset(wall?.backElevationProfile, progress)
    if (front - back < minimumThickness) {
      if (wall?.frontElevationProfile && !wall?.backElevationProfile) front = back + minimumThickness
      else if (wall?.backElevationProfile && !wall?.frontElevationProfile) back = front - minimumThickness
      else {
        const center = (front + back) / 2
        front = center + minimumThickness / 2
        back = center - minimumThickness / 2
      }
    }
  }
  return { front, back }
}

function compiledWallProfileProgressAtY(wall, y) {
  const origin = Number.isFinite(Number(wall?.elevationProfileOriginY))
    ? Number(wall.elevationProfileOriginY)
    : number(wall?.y)
  const span = positive(wall?.elevationProfileHeight, positive(wall?.height, SURFACE_STORY_HEIGHT_DEFAULT))
  return Math.max(0, Math.min(1, (number(y) - origin) / span))
}

function compiledCornerJoinPadding(wall, join) {
  const ownNormal = join?.normal
  const tangent = join?.tangent
  if (!ownNormal || !tangent) return 0
  let padding = 0
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const y = number(wall.y) + positive(wall.height, SURFACE_STORY_HEIGHT_DEFAULT) * progress
    const ownDistances = compiledWallFaceDistances(wall, compiledWallProfileProgressAtY(wall, y))
    for (const side of ['front', 'back']) {
      const faceJoin = join?.[side]
      const neighbor = faceJoin?.neighbor || join?.neighbor
      const neighborNormal = neighbor?.normal
      const neighborSide = faceJoin?.neighborSide || join?.[`${side}NeighborSide`]
      if (!neighbor || !neighborNormal) continue
      if (!['front', 'back'].includes(neighborSide)) continue
      const neighborDistances = compiledWallFaceDistances(
        neighbor,
        compiledWallProfileProgressAtY(neighbor, y),
      )
      const intersection = wallCornerIntersectionPoint({
        point: { x: 0, z: 0 },
        tangent,
        normal: ownNormal,
        distance: ownDistances[side],
        neighborNormal,
        neighborDistance: neighborDistances[neighborSide],
      })
      if (intersection) padding = Math.max(padding, Math.abs(intersection.along))
    }
  }
  return clean(padding)
}

function withCompiledWallProfileJoins(walls) {
  return withWallCornerJoins(walls, wall => wall.sourceWorldIds).map(wall => {
    const joinNeighbors = [
      wall.profileJoinStart?.front?.neighbor,
      wall.profileJoinStart?.back?.neighbor,
      wall.profileJoinEnd?.front?.neighbor,
      wall.profileJoinEnd?.back?.neighbor,
      wall.profileJoinStart?.neighbor,
      wall.profileJoinEnd?.neighbor,
    ].filter(Boolean)
    const joinsProfile = maximumWallProfileDepth(wall) > EPSILON
      || joinNeighbors.some(neighbor => maximumWallProfileDepth(neighbor) > EPSILON)
    if (!joinsProfile) return wall
    const profileJoinStartPadding = compiledCornerJoinPadding(wall, wall.profileJoinStart)
    const profileJoinEndPadding = compiledCornerJoinPadding(wall, wall.profileJoinEnd)
    return {
      ...wall,
      ...(profileJoinStartPadding > EPSILON ? { profileJoinStartPadding } : {}),
      ...(profileJoinEndPadding > EPSILON ? { profileJoinEndPadding } : {}),
    }
  })
}

function roomWallCandidates(surface, battlemapId) {
  const walls = new Map()
  for (const room of Object.values(surface.rooms)) {
    if (room.wallEnabled === false) continue
    const baseY = roomBaseY(room, surface.storyHeight)
    const elevationProfileHeight = roomHeightLevels(room, surface.storyHeight) * surface.storyHeight
    const thickness = positive(room.wallThickness, 1) / surface.fine
    const slices = roomVerticalSlices(room, surface.rooms, surface.storyHeight)
    for (const slice of slices) {
      const y = baseY + slice.offset * surface.storyHeight
      for (const segment of slice.wallPaths) {
        const frontIsInterior = Number.isFinite(Number(segment.interiorNormalSign))
          ? Number(segment.interiorNormalSign) >= 0
          : segment.axis === 'x'
            ? number(segment.x1) >= number(segment.x0)
            : segment.axis === 'z'
              ? number(segment.z1) <= number(segment.z0)
              : true
        const addBoundary = wall => addWallCandidate(walls, {
          ...room,
          ...wall,
          y,
          height: surface.storyHeight,
          thickness,
          interiorFace: frontIsInterior ? 'front' : 'back',
          elevationProfileFace: frontIsInterior ? 'front' : 'back',
          elevationProfileOriginY: baseY,
          elevationProfileHeight,
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
  return withCompiledWallProfileJoins([...walls.values()].map(finalizeWallElevationProfiles))
}

function wallPieceFromCandidate(wall) {
  if (wall.axis === 'segment' || wall.axis === 'arc') {
    return {
      ...wall,
      bottom: wall.y,
      top: wall.y + wall.height,
      suffix: 'full',
    }
  }
  const reversed = wall.axis === 'x'
    ? number(wall.x1) < number(wall.x0)
    : number(wall.z1) < number(wall.z0)
  const orientedWall = reversed ? {
    ...wall,
    frontElevationProfile: wall.backElevationProfile || null,
    backElevationProfile: wall.frontElevationProfile || null,
    profileJoinStartMiter: wall.profileJoinEndMiter || null,
    profileJoinEndMiter: wall.profileJoinStartMiter || null,
    profileJoinStartPadding: number(wall.profileJoinEndPadding),
    profileJoinEndPadding: number(wall.profileJoinStartPadding),
    ...(wall.elevationProfileDirection
      ? { elevationProfileDirection: -number(wall.elevationProfileDirection) }
      : {}),
  } : wall
  return {
    ...orientedWall,
    alongMin: wall.axis === 'x' ? Math.min(wall.x0, wall.x1) : Math.min(wall.z0, wall.z1),
    alongMax: wall.axis === 'x' ? Math.max(wall.x0, wall.x1) : Math.max(wall.z0, wall.z1),
    line: wall.axis === 'x' ? wall.z0 : wall.x0,
    bottom: wall.y,
    top: wall.y + wall.height,
    suffix: 'full',
  }
}

function wallOpeningGeometry(connector, surface, runtimeState) {
  const axis = connector.axis
  const geometry = connector.modelGeometry || {}
  const explicitOpening = number(geometry.openingWidth || geometry.doorPanelWidth || geometry.door_panel_width_m)
  const explicitCut = number(geometry.wallCutWidth || geometry.footprintWidth || geometry.footprint_width_m)
  const storedWidth = Math.hypot(
    number(connector.x1) - number(connector.x0),
    number(connector.z1) - number(connector.z0),
  ) / surface.fine
  const cutWidth = positive(explicitCut, positive(storedWidth, positive(connector.width, positive(geometry.width, 1))))
  const openingWidth = positive(explicitOpening, Math.max(0.25, cutWidth - 0.02))
  const state = runtimeState?.state || connector.state || (connector.type === 'door' ? 'closed' : 'transparent')
  const bottom = number(connector.y)
  const height = positive(geometry.height, positive(connector.height, 2))
  const thickness = Math.max(
    positive(connector.thickness, 1) / surface.fine,
    positive(connector.depth, 0.25),
  )
  if (axis === 'segment') {
    const anchorX = number(connector.anchorX, (number(connector.x0) + number(connector.x1)) / (2 * surface.fine))
    const anchorZ = number(connector.anchorZ, (number(connector.z0) + number(connector.z1)) / (2 * surface.fine))
    const tangentLength = Math.hypot(number(connector.tangentX), number(connector.tangentZ)) || 1
    const tangentX = number(connector.tangentX, 1) / tangentLength
    const tangentZ = number(connector.tangentZ) / tangentLength
    const normalLength = Math.hypot(number(connector.normalX), number(connector.normalZ)) || 1
    const normalX = number(connector.normalX, -tangentZ) / normalLength
    const normalZ = number(connector.normalZ, tangentX) / normalLength
    const curveOffset = number(connector.curveOffset)
    return {
      connector,
      worldId: connector.worldId,
      axis,
      curveId: connector.curveId,
      curveOffset,
      alongMin: curveOffset - openingWidth / 2,
      alongMax: curveOffset + openingWidth / 2,
      cutAlongMin: curveOffset - cutWidth / 2,
      cutAlongMax: curveOffset + cutWidth / 2,
      anchorX,
      anchorZ,
      tangentX,
      tangentZ,
      normalX,
      normalZ,
      bottom,
      top: bottom + height,
      thickness,
      state,
    }
  }

  const alongStart = axis === 'x' ? number(connector.x0) : number(connector.z0)
  const alongEnd = axis === 'x' ? number(connector.x1) : number(connector.z1)
  const centerFine = Number.isFinite(Number(connector.alongCenter))
    ? Number(connector.alongCenter)
    : (alongStart + alongEnd) / 2
  const center = centerFine / surface.fine
  const line = (axis === 'x' ? number(connector.z0) : number(connector.x0)) / surface.fine
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
  if (door.axis === 'segment' && wall.axis === 'arc') {
    const wallMin = Math.min(number(wall.curveOffset0), number(wall.curveOffset1))
    const wallMax = Math.max(number(wall.curveOffset0), number(wall.curveOffset1))
    return door.curveId === wall.curveId
      && door.top > wall.bottom + EPSILON
      && door.bottom < wall.top - EPSILON
      && door.cutAlongMax > wallMin + EPSILON
      && door.cutAlongMin < wallMax - EPSILON
  }
  return door.axis === wall.axis
    && Math.abs(door.line - wall.line) <= EPSILON
    && door.top > wall.bottom + EPSILON
    && door.bottom < wall.top - EPSILON
    && door.cutAlongMax > wall.alongMin + EPSILON
    && door.cutAlongMin < wall.alongMax - EPSILON
}

function splitWallPiece(piece, door) {
  if (!doorMatchesWall(door, piece)) return [piece]
  if (piece.axis === 'arc') {
    const wallOffset0 = number(piece.curveOffset0)
    const wallOffset1 = number(piece.curveOffset1)
    const wallMin = Math.min(wallOffset0, wallOffset1)
    const wallMax = Math.max(wallOffset0, wallOffset1)
    const openingMin = Math.max(wallMin, door.cutAlongMin)
    const openingMax = Math.min(wallMax, door.cutAlongMax)
    const openingBottom = Math.max(piece.bottom, door.bottom)
    const openingTop = Math.min(piece.top, door.top)
    if (openingMax <= openingMin + EPSILON || openingTop <= openingBottom + EPSILON) return [piece]
    const rawT0 = (openingMin - wallOffset0) / (wallOffset1 - wallOffset0)
    const rawT1 = (openingMax - wallOffset0) / (wallOffset1 - wallOffset0)
    const fromT = Math.max(0, Math.min(rawT0, rawT1))
    const toT = Math.min(1, Math.max(rawT0, rawT1))
    const patchArc = (startT, endT) => {
      const startAngle = number(piece.startAngle) + number(piece.sweep) * startT
      const sweep = number(piece.sweep) * (endT - startT)
      const endAngle = startAngle + sweep
      return {
        startAngle,
        sweep,
        curveOffset0: wallOffset0 + (wallOffset1 - wallOffset0) * startT,
        curveOffset1: wallOffset0 + (wallOffset1 - wallOffset0) * endT,
        x0: number(piece.centerX) + Math.cos(startAngle) * number(piece.radius),
        z0: number(piece.centerZ) + Math.sin(startAngle) * number(piece.radius),
        x1: number(piece.centerX) + Math.cos(endAngle) * number(piece.radius),
        z1: number(piece.centerZ) + Math.sin(endAngle) * number(piece.radius),
      }
    }
    const parts = []
    const pushArc = (suffix, startT, endT, bottom, top, patch = {}) => {
      if (endT <= startT + EPSILON || top <= bottom + EPSILON) return
      parts.push({
        ...piece,
        ...patchArc(startT, endT),
        suffix: `${piece.suffix}:${suffix}`,
        bottom,
        top,
        ...patch,
      })
    }
    pushArc('before', 0, fromT, piece.bottom, piece.top, { profileJoinEndPadding: 0 })
    pushArc('after', toT, 1, piece.bottom, piece.top, { profileJoinStartPadding: 0 })
    pushArc('below', fromT, toT, piece.bottom, openingBottom, { profileJoinStartPadding: 0, profileJoinEndPadding: 0 })
    pushArc('above', fromT, toT, openingTop, piece.top, { profileJoinStartPadding: 0, profileJoinEndPadding: 0 })
    return parts
  }
  const openingMin = Math.max(piece.alongMin, door.cutAlongMin)
  const openingMax = Math.min(piece.alongMax, door.cutAlongMax)
  const openingBottom = Math.max(piece.bottom, door.bottom)
  const openingTop = Math.min(piece.top, door.top)
  if (openingMax <= openingMin + EPSILON || openingTop <= openingBottom + EPSILON) return [piece]

  const parts = []
  const push = (suffix, alongMin, alongMax, bottom, top, patch = {}) => {
    if (alongMax <= alongMin + EPSILON || top <= bottom + EPSILON) return
    parts.push({ ...piece, suffix: `${piece.suffix}:${suffix}`, alongMin, alongMax, bottom, top, ...patch })
  }
  push('before', piece.alongMin, openingMin, piece.bottom, piece.top, { profileJoinEndPadding: 0 })
  push('after', openingMax, piece.alongMax, piece.bottom, piece.top, { profileJoinStartPadding: 0 })
  push('below', openingMin, openingMax, piece.bottom, openingBottom, { profileJoinStartPadding: 0, profileJoinEndPadding: 0 })
  push('above', openingMin, openingMax, openingTop, piece.top, { profileJoinStartPadding: 0, profileJoinEndPadding: 0 })
  return parts
}

function wallPieceBounds(piece) {
  const profileDepth = Math.max(
    Math.abs(number(piece.elevationProfile?.depth)),
    Math.abs(number(piece.frontElevationProfile?.depth)),
    Math.abs(number(piece.backElevationProfile?.depth)),
  )
  const joinStart = Math.max(0, number(piece.profileJoinStartPadding))
  const joinEnd = Math.max(0, number(piece.profileJoinEndPadding))
  const half = piece.thickness / 2 + profileDepth
  const cornerBroadphase = half + Math.max(joinStart, joinEnd)
  if (piece.axis === 'arc') {
    const start = number(piece.startAngle)
    const sweep = number(piece.sweep)
    const normalizeAngle = value => ((value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const progressForAngle = angle => {
      if (Math.abs(sweep) <= EPSILON) return null
      const delta = sweep > 0
        ? normalizeAngle(angle - start)
        : normalizeAngle(start - angle)
      return delta / Math.abs(sweep)
    }
    const angles = [start, start + sweep]
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const progress = progressForAngle(angle)
      if (progress !== null && progress >= -EPSILON && progress <= 1 + EPSILON) angles.push(angle)
    }
    const xs = angles.map(angle => number(piece.centerX) + Math.cos(angle) * number(piece.radius))
    const zs = angles.map(angle => number(piece.centerZ) + Math.sin(angle) * number(piece.radius))
    return bounds(
      Math.min(...xs) - cornerBroadphase,
      piece.bottom,
      Math.min(...zs) - cornerBroadphase,
      Math.max(...xs) + cornerBroadphase,
      piece.top,
      Math.max(...zs) + cornerBroadphase,
    )
  }
  if (piece.axis === 'x') {
    return bounds(piece.alongMin - joinStart, piece.bottom, piece.line - half, piece.alongMax + joinEnd, piece.top, piece.line + half)
  }
  if (piece.axis === 'segment') {
    return bounds(
      Math.min(piece.x0, piece.x1) - cornerBroadphase,
      piece.bottom,
      Math.min(piece.z0, piece.z1) - cornerBroadphase,
      Math.max(piece.x0, piece.x1) + cornerBroadphase,
      piece.top,
      Math.max(piece.z0, piece.z1) + cornerBroadphase,
    )
  }
  return bounds(piece.line - half, piece.bottom, piece.alongMin - joinStart, piece.line + half, piece.top, piece.alongMax + joinEnd)
}

function wallPieceGeometry(piece) {
  const elevation = piece.elevationProfileMode ? {
    elevationProfileMode: piece.elevationProfileMode,
    ...(piece.elevationProfile ? { elevationProfile: piece.elevationProfile } : {}),
    ...(piece.elevationProfileDirection ? { elevationProfileDirection: piece.elevationProfileDirection } : {}),
    ...(piece.frontElevationProfile ? { frontElevationProfile: piece.frontElevationProfile } : {}),
    ...(piece.backElevationProfile ? { backElevationProfile: piece.backElevationProfile } : {}),
    elevationProfileOriginY: clean(piece.elevationProfileOriginY ?? piece.y ?? piece.bottom),
    elevationProfileHeight: clean(piece.elevationProfileHeight ?? piece.height ?? (piece.top - piece.bottom)),
  } : {}
  if (piece.axis === 'arc') {
    return {
      type: 'wall-arc',
      center: { x: clean(piece.centerX), z: clean(piece.centerZ) },
      radius: clean(piece.radius),
      startAngle: clean(piece.startAngle),
      sweep: clean(piece.sweep),
      from: { x: clean(piece.x0), z: clean(piece.z0) },
      to: { x: clean(piece.x1), z: clean(piece.z1) },
      minY: clean(piece.bottom),
      maxY: clean(piece.top),
      thickness: clean(piece.thickness),
      ...(piece.profileJoinStartPadding > EPSILON ? { profileJoinStartPadding: clean(piece.profileJoinStartPadding) } : {}),
      ...(piece.profileJoinEndPadding > EPSILON ? { profileJoinEndPadding: clean(piece.profileJoinEndPadding) } : {}),
      ...elevation,
    }
  }
  const from = piece.axis === 'x'
    ? { x: piece.alongMin, z: piece.line }
    : piece.axis === 'z'
      ? { x: piece.line, z: piece.alongMin }
      : { x: piece.x0, z: piece.z0 }
  const to = piece.axis === 'x'
    ? { x: piece.alongMax, z: piece.line }
    : piece.axis === 'z'
      ? { x: piece.line, z: piece.alongMax }
      : { x: piece.x1, z: piece.z1 }
  return {
    type: 'wall-segment',
    from: { x: clean(from.x), z: clean(from.z) },
    to: { x: clean(to.x), z: clean(to.z) },
    minY: clean(piece.bottom),
    maxY: clean(piece.top),
    thickness: clean(piece.thickness),
    ...(piece.profileJoinStartPadding > EPSILON ? { profileJoinStartPadding: clean(piece.profileJoinStartPadding) } : {}),
    ...(piece.profileJoinEndPadding > EPSILON ? { profileJoinEndPadding: clean(piece.profileJoinEndPadding) } : {}),
    ...elevation,
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

function skylightCoveringSlab(surface, slab, y) {
  return Object.values(surface.connectors).find(connector => {
    if (connector.type !== 'skylight' || Math.abs(number(connector.y) - number(y)) > EPSILON) return false
    const minX = number(connector.x)
    const minZ = number(connector.z)
    const maxX = minX + positive(connector.width, 1)
    const maxZ = minZ + positive(connector.depth, 1)
    const centerX = number(slab.x) + 0.5
    const centerZ = number(slab.z) + 0.5
    return centerX > minX + EPSILON && centerX < maxX - EPSILON
      && centerZ > minZ + EPSILON && centerZ < maxZ - EPSILON
  })
}

function rectangleMultiPolygon(rectangle) {
  return [[[
    [rectangle.minX, rectangle.minZ],
    [rectangle.maxX, rectangle.minZ],
    [rectangle.maxX, rectangle.maxZ],
    [rectangle.minX, rectangle.maxZ],
    [rectangle.minX, rectangle.minZ],
  ]]]
}

function stairOpeningsAtY(surface, y) {
  return Object.values(surface.stairs)
    .filter(stair => Math.abs(number(stair.topY) - number(y)) <= EPSILON)
    .map(stair => stairOpeningMultiPolygon(stair, { storyHeight: surface.storyHeight }))
}

function addSlabs(surface, runtimeStates, battlemapId, spatial) {
  const elevators = surfaceElevators(surface)
  for (const [legacyId, floor] of roomFloorEntries(surface, battlemapId)) {
    const parsed = parseFloor(legacyId, floor)
    const thickness = positive(floor.thickness, 0.25)
    if (slabIsInsideElevatorShaft(elevators, parsed, parsed.y + thickness / 2)) continue
    if (skylightCoveringSlab(surface, parsed, parsed.y)) continue
    let sourceFootprint = null
    if (floor.clipRoomId && surface.rooms[floor.clipRoomId]) {
      const room = { id: floor.clipRoomId, ...surface.rooms[floor.clipRoomId] }
      const tile = [[[[parsed.x, parsed.z], [parsed.x + 1, parsed.z], [parsed.x + 1, parsed.z + 1], [parsed.x, parsed.z + 1], [parsed.x, parsed.z]]]]
      sourceFootprint = intersectMultiPolygons(
        tile,
        roomInteriorFootprintAtY(room, parsed.y, surface.rooms, surface.storyHeight),
      )
      if (sourceFootprint.length === 0) continue
    }
    const sourceId = floor.worldId
    const runtime = runtimeStates[sourceId]
    if (floor.runtimeSupport && (runtime?.enabled === false || runtime?.state === 'destroyed')) continue
    const kind = floor.kind || 'floor'
    const tileFootprint = rectangleMultiPolygon({
      minX: parsed.x,
      maxX: parsed.x + 1,
      minZ: parsed.z,
      maxZ: parsed.z + 1,
    })
    const baseFootprint = sourceFootprint || tileFootprint
    const clippedFootprint = differenceMultiPolygons(
      baseFootprint,
      ...stairOpeningsAtY(surface, parsed.y),
    )
    for (const [fragmentIndex, polygon] of clippedFootprint.entries()) {
      const slabFootprint = [polygon]
      const footprintBounds = multiPolygonBounds(slabFootprint)
      const slabBounds = bounds(
        footprintBounds.minX, parsed.y - thickness / 2, footprintBounds.minZ,
        footprintBounds.maxX, parsed.y + thickness / 2, footprintBounds.maxZ,
      )
      const candidates = []
      for (let iz = 0; iz <= 8; iz += 1) {
        for (let ix = 0; ix <= 8; ix += 1) {
          candidates.push({
            x: slabBounds.min.x + (slabBounds.max.x - slabBounds.min.x) * ix / 8,
            z: slabBounds.min.z + (slabBounds.max.z - slabBounds.min.z) * iz / 8,
          })
        }
      }
      const center = {
        x: (slabBounds.min.x + slabBounds.max.x) / 2,
        z: (slabBounds.min.z + slabBounds.max.z) / 2,
      }
      const inside = [center, ...candidates]
        .find(candidate => multiPolygonContainsPoint(slabFootprint, candidate)) || center
      const suffix = clippedFootprint.length > 1 ? `:${fragmentIndex}` : ''
      spatial.supports.push({
        id: `support:${sourceId}${suffix}`,
        sourceId,
        kind,
        bounds: slabBounds,
        footprint: slabFootprint,
        point: { ...inside, y: clean(parsed.y + thickness / 2) },
        y: clean(parsed.y + thickness / 2),
        walkable: floor.walkable !== false,
        movementMultiplier: movementMultiplier(floor),
      })
      addBarrierOutputs(spatial, {
        id: `barrier:floor:${sourceId}${suffix}`,
        sourceId,
        kind,
        axis: 'horizontal',
        bounds: slabBounds,
        geometry: {
          type: 'horizontal-multipolygon',
          multiPolygon: slabFootprint,
          minY: clean(parsed.y - thickness / 2),
          maxY: clean(parsed.y + thickness / 2),
        },
        blocks: blockingChannels(floor),
      })
    }
  }

  for (const [legacyId, ceiling] of roomCeilingEntries(surface, battlemapId)) {
    const parsed = parseCeiling(legacyId, ceiling)
    const thickness = positive(ceiling.thickness, 0.25)
    if (slabIsInsideElevatorShaft(elevators, parsed, parsed.y + thickness / 2)) continue
    if (skylightCoveringSlab(surface, parsed, parsed.y)) continue
    const clippedFootprint = differenceMultiPolygons(rectangleMultiPolygon({
      minX: parsed.x,
      maxX: parsed.x + 1,
      minZ: parsed.z,
      maxZ: parsed.z + 1,
    }), ...stairOpeningsAtY(surface, parsed.y))
    for (const [fragmentIndex, polygon] of clippedFootprint.entries()) {
      const slabFootprint = [polygon]
      const footprintBounds = multiPolygonBounds(slabFootprint)
      const suffix = clippedFootprint.length > 1 ? `:${fragmentIndex}` : ''
      const slabBounds = bounds(
        footprintBounds.minX, parsed.y - thickness / 2, footprintBounds.minZ,
        footprintBounds.maxX, parsed.y + thickness / 2, footprintBounds.maxZ,
      )
      addBarrierOutputs(spatial, {
        id: `barrier:ceiling:${ceiling.worldId}${suffix}`,
        sourceId: ceiling.worldId,
        kind: 'ceiling',
        axis: 'horizontal',
        bounds: slabBounds,
        geometry: {
          type: 'horizontal-multipolygon',
          multiPolygon: slabFootprint,
          minY: clean(parsed.y - thickness / 2),
          maxY: clean(parsed.y + thickness / 2),
        },
        blocks: blockingChannels(ceiling),
      })
    }
  }

  for (const connector of Object.values(surface.connectors)) {
    if (connector.type !== 'skylight') continue
    const x = number(connector.x)
    const y = number(connector.y)
    const z = number(connector.z)
    const width = positive(connector.width, 1)
    const depth = positive(connector.depth, 1)
    const thickness = positive(connector.height, 0.1)
    const glassBounds = bounds(x, y - thickness / 2, z, x + width, y + thickness / 2, z + depth)
    spatial.supports.push({
      id: `support:skylight:${connector.worldId}`,
      sourceId: connector.worldId,
      kind: 'skylight',
      bounds: glassBounds,
      y: clean(y + thickness / 2),
      walkable: true,
      movementMultiplier: 1,
    })
    addBarrierOutputs(spatial, {
      id: `barrier:skylight:${connector.worldId}`,
      sourceId: connector.worldId,
      kind: 'skylight',
      axis: 'horizontal',
      bounds: glassBounds,
      blocks: { movement: true, sight: false, water: true, gas: true },
    })
  }
}

function addWallsAndDoors(surface, runtimeStates, battlemapId, spatial, worldDocument) {
  const doors = Object.values(surface.connectors)
    .filter(connector => ['door', 'window', 'screen-window'].includes(connector.type))
    .map(connector => wallOpeningGeometry(connector, surface, runtimeStates[connector.worldId]))
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
    const isDoor = connector.type === 'door'
    const isOpen = isDoor && door.state === 'open'
    const blocks = isOpen
      ? { movement: false, sight: false, water: false, gas: false }
      : isDoor
        ? blockingChannels(connector, 'door')
        : { movement: true, sight: door.state !== 'transparent', water: true, gas: true }
    const half = door.thickness / 2
    const doorFrom = door.axis === 'segment'
      ? {
          x: door.anchorX - door.tangentX * (door.alongMax - door.alongMin) / 2,
          z: door.anchorZ - door.tangentZ * (door.alongMax - door.alongMin) / 2,
        }
      : null
    const doorTo = door.axis === 'segment'
      ? {
          x: door.anchorX + door.tangentX * (door.alongMax - door.alongMin) / 2,
          z: door.anchorZ + door.tangentZ * (door.alongMax - door.alongMin) / 2,
        }
      : null
    const doorBounds = door.axis === 'segment'
      ? bounds(
          Math.min(doorFrom.x, doorTo.x) - half,
          door.bottom,
          Math.min(doorFrom.z, doorTo.z) - half,
          Math.max(doorFrom.x, doorTo.x) + half,
          door.top,
          Math.max(doorFrom.z, doorTo.z) + half,
        )
      : door.axis === 'x'
      ? bounds(door.alongMin, door.bottom, door.line - half, door.alongMax, door.top, door.line + half)
      : bounds(door.line - half, door.bottom, door.alongMin, door.line + half, door.top, door.alongMax)
    addBarrierOutputs(spatial, {
      id: `barrier:${connector.type}:${door.worldId}`,
      sourceId: door.worldId,
      kind: connector.type,
      axis: door.axis,
      state: door.state,
      bounds: doorBounds,
      ...(door.axis === 'segment' ? {
        geometry: {
          type: 'wall-segment',
          from: { x: clean(doorFrom.x), z: clean(doorFrom.z) },
          to: { x: clean(doorTo.x), z: clean(doorTo.z) },
          minY: clean(door.bottom),
          maxY: clean(door.top),
          thickness: clean(door.thickness),
        },
      } : {}),
      blocks,
    })

    if (!isDoor) continue
    const center = (door.alongMin + door.alongMax) / 2
    const feetY = door.bottom
    const margin = half + 0.05
    const from = door.axis === 'segment'
      ? point(door.anchorX - door.normalX * margin, feetY, door.anchorZ - door.normalZ * margin)
      : door.axis === 'x'
      ? point(center, feetY, door.line - margin)
      : point(door.line - margin, feetY, center)
    const to = door.axis === 'segment'
      ? point(door.anchorX + door.normalX * margin, feetY, door.anchorZ + door.normalZ * margin)
      : door.axis === 'x'
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
    const geometry = stairGeometry(stair, { storyHeight: surface.storyHeight })
    const from = geometry.anchors[0]
    const to = geometry.anchors.at(-1)
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
      anchors: geometry.anchors,
    })
    spatial.supports.push({
      id: `support:stairs:${stair.worldId}`,
      sourceId: stair.worldId,
      kind: 'stairs',
      bounds: bounds(
        geometry.footprint.minX, geometry.baseSurfaceY, geometry.footprint.minZ,
        geometry.footprint.maxX, geometry.topSurfaceY, geometry.footprint.maxZ,
      ),
      from,
      to,
      anchors: geometry.anchors,
      walkable: stair.walkable !== false,
      movementMultiplier: movementMultiplier(stair),
    })
    for (const step of geometry.steps) {
      addBarrierOutputs(spatial, {
        id: `barrier:stairs:${stair.worldId}:step:${step.index}`,
        sourceId: stair.worldId,
        kind: 'stairs-solid',
        axis: 'box',
        bounds: step.bounds,
        ...(step.polygon ? {
          geometry: {
            type: 'horizontal-prism',
            polygon: step.polygon,
            minY: step.minY,
            maxY: step.maxY,
          },
        } : {}),
        blocks: blockingChannels(stair),
      })
    }
    if (geometry.column) {
      addBarrierOutputs(spatial, {
        id: `barrier:stairs:${stair.worldId}:column`,
        sourceId: stair.worldId,
        kind: 'stairs-column',
        axis: 'cylinder',
        bounds: geometry.column.bounds,
        geometry: {
          type: 'vertical-cylinder',
          center: { x: geometry.column.center.x, z: geometry.column.center.z },
          radius: geometry.column.radius,
          minY: geometry.column.minY,
          maxY: geometry.column.maxY,
        },
        blocks: blockingChannels(stair),
      })
    }
    for (const rail of geometry.railParts) {
      addBarrierOutputs(spatial, {
        id: `barrier:stairs:${stair.worldId}:rail:${rail.side}:${rail.kind}:${rail.index}`,
        sourceId: stair.worldId,
        kind: 'stairs-railing',
        axis: 'box',
        bounds: rail.bounds,
        blocks: { movement: true, sight: false, water: false, gas: false },
      })
    }
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
    const verticalProfile = roomVerticalSlices(identifiedRoom, surface.rooms, surface.storyHeight)
      .map(slice => ({ offset: slice.offset, footprint: slice.footprint }))
    spatial.compartments.push({
      id: `compartment:${room.worldId}`,
      sourceId: room.worldId,
      kind: 'room',
      bounds: bounds(area.minX, baseY, area.minZ, area.maxX, topY, area.maxZ),
      footprint: cells.map(cell => roomCellKey(cell.x, cell.z)),
      verticalProfile,
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
