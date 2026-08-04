// roomWalls.js — Assemblage des murs de pièces
// Extrait de surfaceData.js, Lot 2a du PLAN_REFACTOR_SURFACE.md

import { formatLevel, hashString } from './surfaceUtils.js'
import {
  STORY_HEIGHT,
  SURFACE_FINE,
  getRoomBaseY,
  getRoomHeightLevels,
} from './surfaceCore.js'
import {
  roomVerticalSlices,
  sampleWallArcGeometry,
  withWallCornerJoins,
} from '../../../shared/world/roomGeometry.js'

// ===================================================================
// Helpers internes
// ===================================================================

function roomWallInteriorTex(room) {
  return room?.wallInteriorTex || null
}

function roomWallInteriorMaterial(room) {
  return room?.wallInteriorMaterial || null
}

function setWallFace(wall, face, source) {
  if (!wall || !source) return
  if (source.role === 'interior' && source.roomId) {
    const field = face === 'front' ? 'frontRoomIds' : 'backRoomIds'
    wall[field] = [...new Set([...(wall[field] || []), source.roomId])]
  }
  const rolePriority = source.role === 'interior' ? 2 : source.role === 'exterior' ? 1 : 0
  if (face === 'front') {
    if ((wall._frontRolePriority || 0) > rolePriority) return
    if (source.tex) wall.frontTex = source.tex
    if (source.material) wall.frontMaterial = source.material
    wall.frontRole = source.role || null
    wall._frontRolePriority = rolePriority
  } else {
    if ((wall._backRolePriority || 0) > rolePriority) return
    if (source.tex) wall.backTex = source.tex
    if (source.material) wall.backMaterial = source.material
    wall.backRole = source.role || null
    wall._backRolePriority = rolePriority
  }
}

function ensureRoomWallPanel(panels, key, data) {
  if (!panels.has(key)) {
    panels.set(key, {
      id: key,
      axis: data.axis,
      y: data.y,
      height: STORY_HEIGHT,
      thickness: data.thickness,
      barrierType: data.room.barrierType,
      blocksSight: data.room.blocksSight,
      blocksMovement: data.room.blocksMovement,
      blocksWater: data.room.blocksWater,
      x0: data.x0,
      x1: data.x1,
      z0: data.z0,
      z1: data.z1,
      curveId: data.curveId || null,
      curveArcId: data.curveArcId || null,
      curveOffset0: data.curveOffset0,
      curveOffset1: data.curveOffset1,
      curveLength: data.curveLength,
      curveCenterX: data.curveCenterX,
      curveCenterZ: data.curveCenterZ,
      curveRadius: data.curveRadius,
      curveStartAngle: data.curveStartAngle,
      curveSweep: data.curveSweep,
      frontElevationProfile: null,
      backElevationProfile: null,
      elevationProfileOriginY: data.elevationProfileOriginY ?? data.y,
      elevationProfileHeight: data.elevationProfileHeight ?? STORY_HEIGHT,
      frontTex: null,
      backTex: null,
      topTex: roomWallInteriorTex(data.room),
      frontMaterial: null,
      backMaterial: null,
      material: roomWallInteriorMaterial(data.room),
      roomIds: [],
      sourceEdgeKeys: [],
      interiorNormalSignsByRoom: {},
    })
  }

  const wall = panels.get(key)
  wall.thickness = Math.max(Number(wall.thickness) || 1, Number(data.thickness) || 1)
  if (data.room.barrierType === 'solid') wall.barrierType = 'solid'
  else if (!wall.barrierType) wall.barrierType = data.room.barrierType
  wall.blocksSight = wall.blocksSight || data.room.blocksSight
  wall.blocksMovement = wall.blocksMovement || data.room.blocksMovement
  wall.blocksWater = wall.blocksWater || data.room.blocksWater
  if (data.room.id && !wall.roomIds.includes(data.room.id)) wall.roomIds.push(data.room.id)
  if (Array.isArray(data.sourceEdgeKeys)) {
    wall.sourceEdgeKeys = [...new Set([
      ...(wall.sourceEdgeKeys || []),
      ...data.sourceEdgeKeys.map(String),
    ])]
  }
  return wall
}

function completeRoomWallPanel(wall) {
  if (!wall) return wall
  if (!wall.frontTex && !wall.frontMaterial) {
    wall.frontTex = wall.backTex
    wall.frontMaterial = wall.backMaterial
  }
  if (!wall.backTex && !wall.backMaterial) {
    wall.backTex = wall.frontTex
    wall.backMaterial = wall.frontMaterial
  }
  if (!wall.topTex) wall.topTex = wall.frontTex || wall.backTex
  if (!wall.material) wall.material = wall.frontMaterial || wall.backMaterial
  if (wall.roomIds.length === 1) {
    const exteriorProfile = wall.frontElevationProfile || wall.backElevationProfile || null
    if (exteriorProfile) {
      wall.elevationProfileMode = 'translated'
      wall.elevationProfile = exteriorProfile
      wall.elevationProfileDirection = wall.frontElevationProfile ? 1 : -1
    }
  } else if (wall.frontElevationProfile || wall.backElevationProfile) {
    wall.elevationProfileMode = 'faces'
  }
  delete wall._frontRolePriority
  delete wall._backRolePriority
  return wall
}

function curveWallStyleKey(wall) {
  return JSON.stringify({
    curveId: wall.curveId,
    y: wall.y,
    height: wall.height,
    thickness: wall.thickness,
    frontTex: wall.frontTex,
    backTex: wall.backTex,
    topTex: wall.topTex,
    frontMaterial: wall.frontMaterial,
    backMaterial: wall.backMaterial,
    material: wall.material,
    elevationProfileMode: wall.elevationProfileMode,
    elevationProfile: wall.elevationProfile,
    elevationProfileDirection: wall.elevationProfileDirection,
    frontElevationProfile: wall.frontElevationProfile,
    backElevationProfile: wall.backElevationProfile,
  })
}

function straightWallStyleKey(wall) {
  return JSON.stringify({
    axis: wall.axis,
    direction: wall.axis === 'x'
      ? Math.sign(Number(wall.x1) - Number(wall.x0))
      : Math.sign(Number(wall.z1) - Number(wall.z0)),
    line: wall.axis === 'x' ? Number(wall.z0) : Number(wall.x0),
    y: wall.y,
    height: wall.height,
    thickness: wall.thickness,
    barrierType: wall.barrierType,
    blocksSight: wall.blocksSight,
    blocksMovement: wall.blocksMovement,
    blocksWater: wall.blocksWater,
    frontTex: wall.frontTex,
    backTex: wall.backTex,
    topTex: wall.topTex,
    frontMaterial: wall.frontMaterial,
    backMaterial: wall.backMaterial,
    material: wall.material,
    frontRole: wall.frontRole,
    backRole: wall.backRole,
    frontRoomIds: [...(wall.frontRoomIds || [])].sort(),
    backRoomIds: [...(wall.backRoomIds || [])].sort(),
    elevationProfileMode: wall.elevationProfileMode,
    elevationProfile: wall.elevationProfile,
    elevationProfileDirection: wall.elevationProfileDirection,
    frontElevationProfile: wall.frontElevationProfile,
    backElevationProfile: wall.backElevationProfile,
  })
}

// ===================================================================
// API publique
// ===================================================================

export function wallCoversPanel(existing, candidate) {
  if (!existing || !candidate || existing.axis !== candidate.axis) return false
  const epsilon = 0.01
  if (candidate.axis === 'segment') {
    const sameDirection = Math.abs(Number(existing.x0) - Number(candidate.x0)) < epsilon
      && Math.abs(Number(existing.z0) - Number(candidate.z0)) < epsilon
      && Math.abs(Number(existing.x1) - Number(candidate.x1)) < epsilon
      && Math.abs(Number(existing.z1) - Number(candidate.z1)) < epsilon
    const reverseDirection = Math.abs(Number(existing.x0) - Number(candidate.x1)) < epsilon
      && Math.abs(Number(existing.z0) - Number(candidate.z1)) < epsilon
      && Math.abs(Number(existing.x1) - Number(candidate.x0)) < epsilon
      && Math.abs(Number(existing.z1) - Number(candidate.z0)) < epsilon
    if (!sameDirection && !reverseDirection) return false
  }
  const sameLine = candidate.axis === 'x'
    ? Math.abs(Number(existing.z0) - Number(candidate.z0)) < epsilon
    : candidate.axis === 'z'
      ? Math.abs(Number(existing.x0) - Number(candidate.x0)) < epsilon
      : true
  if (!sameLine) return false

  const existingStart = candidate.axis === 'x' ? Number(existing.x0) : Number(existing.z0)
  const existingEnd = candidate.axis === 'x' ? Number(existing.x1) : Number(existing.z1)
  const candidateStart = candidate.axis === 'x' ? Number(candidate.x0) : Number(candidate.z0)
  const candidateEnd = candidate.axis === 'x' ? Number(candidate.x1) : Number(candidate.z1)
  const horizontalCovered = candidate.axis === 'segment'
    || (Math.min(existingStart, existingEnd) <= Math.min(candidateStart, candidateEnd) + epsilon
      && Math.max(existingStart, existingEnd) >= Math.max(candidateStart, candidateEnd) - epsilon)
  if (!horizontalCovered) return false

  const existingBottom = Number(existing.y) || 0
  const existingTop = existingBottom + Math.max(0.5, Number(existing.height) || STORY_HEIGHT)
  const candidateBottom = Number(candidate.y) || 0
  const candidateTop = candidateBottom + Math.max(0.5, Number(candidate.height) || STORY_HEIGHT)
  return existingBottom <= candidateBottom + epsilon && existingTop >= candidateTop - epsilon
}

export function addMissingWalls(nextWalls, candidates) {
  let changed = false
  for (const candidate of candidates || []) {
    const covered = Object.values(nextWalls).some(existing => wallCoversPanel(existing, candidate))
    if (covered) continue
    nextWalls[candidate.id] = candidate
    changed = true
  }
  return changed
}

export function wallPointDistanceToPanel(wallPoint, panel) {
  if (!wallPoint || !panel) return null
  const fx = Number(wallPoint.fx)
  const fz = Number(wallPoint.fz)
  if (!Number.isFinite(fx) || !Number.isFinite(fz)) return null

  const x0 = Number(panel.x0)
  const z0 = Number(panel.z0)
  const x1 = Number(panel.x1)
  const z1 = Number(panel.z1)
  const dx = x1 - x0
  const dz = z1 - z0
  const lengthSquared = dx * dx + dz * dz
  if (![x0, z0, x1, z1].every(Number.isFinite) || lengthSquared <= 1e-8) return null
  const rawT = ((fx - x0) * dx + (fz - z0) * dz) / lengthSquared
  const endMargin = SURFACE_FINE * 0.35 / Math.sqrt(lengthSquared)
  if (rawT < -endMargin || rawT > 1 + endMargin) return null
  const t = Math.max(0, Math.min(1, rawT))
  const projectedFx = x0 + dx * t
  const projectedFz = z0 + dz * t
  return {
    distance: Math.hypot(fx - projectedFx, fz - projectedFz),
    t,
    projectedFx,
    projectedFz,
  }
}

export function roomsWallSegments(rooms) {
  const panels = new Map()

  const panelKey = (axis, x0, z0, x1, z1, y) => {
    if (axis === 'x') return `room-wall:x:${Math.min(x0, x1)}:${z0}:${Math.max(x0, x1)}:${z1}:${formatLevel(y)}`
    if (axis === 'z') return `room-wall:z:${x0}:${Math.min(z0, z1)}:${x1}:${Math.max(z0, z1)}:${formatLevel(y)}`
    const start = `${formatLevel(x0)}:${formatLevel(z0)}`
    const end = `${formatLevel(x1)}:${formatLevel(z1)}`
    return start.localeCompare(end) <= 0
      ? `room-wall:segment:${start}:${end}:${formatLevel(y)}`
      : `room-wall:segment:${end}:${start}:${formatLevel(y)}`
  }

  for (const [roomId, rawRoom] of Object.entries(rooms || {})) {
    const room = { id: roomId, ...rawRoom }
    if (!room || room.wallEnabled === false) continue

    const fine = SURFACE_FINE
    const baseY = getRoomBaseY(room)
    const elevationProfileHeight = getRoomHeightLevels(room) * STORY_HEIGHT
    const thickness = Math.max(1, Number(room.wallThickness) || 1)
    const interior = {
      role: 'interior',
      roomId,
      tex: roomWallInteriorTex(room),
      material: roomWallInteriorMaterial(room),
    }
    const addPanel = ({ axis, x0, x1, z0, z1, frontSource, backSource, y, ...geometryMetadata }) => {
      const key = panelKey(axis, x0, z0, x1, z1, y)
      const wall = ensureRoomWallPanel(panels, key, {
        room,
        axis,
        y,
        thickness,
        x0,
        x1,
        z0,
        z1,
        ...geometryMetadata,
      })
      const sameDirection = Math.abs(Number(wall.x0) - Number(x0)) < 0.001
        && Math.abs(Number(wall.z0) - Number(z0)) < 0.001
        && Math.abs(Number(wall.x1) - Number(x1)) < 0.001
        && Math.abs(Number(wall.z1) - Number(z1)) < 0.001
      const rawInteriorNormalSign = Number(geometryMetadata.interiorNormalSign) < 0 ? -1 : 1
      wall.interiorNormalSignsByRoom[room.id] = sameDirection
        ? rawInteriorNormalSign
        : -rawInteriorNormalSign
      setWallFace(wall, 'front', sameDirection ? frontSource : backSource)
      setWallFace(wall, 'back', sameDirection ? backSource : frontSource)
      if (geometryMetadata.elevationProfile) {
        const requestedFace = geometryMetadata.elevationProfileFace === 'back' ? 'back' : 'front'
        const profileFace = sameDirection
          ? requestedFace
          : requestedFace === 'front' ? 'back' : 'front'
        wall[`${profileFace}ElevationProfile`] = geometryMetadata.elevationProfile
      }
    }

    const slices = roomVerticalSlices(room, rooms, STORY_HEIGHT)

    for (const slice of slices) {
      const y = baseY + slice.offset * STORY_HEIGHT

      const boundarySegments = slice.wallPaths.flatMap(path => {
        if (path.axis !== 'arc') return [path]
        const points = sampleWallArcGeometry(path)
        if (points.length < 2) return []
        const pathOffset0 = Number(path.curveOffset0) || 0
        const pathOffset1 = Number.isFinite(Number(path.curveOffset1))
          ? Number(path.curveOffset1)
          : pathOffset0 + Math.abs(Number(path.radius) * Number(path.sweep))
        return points.slice(0, -1).map((from, index) => {
          const to = points[index + 1]
          const t0 = index / (points.length - 1)
          const t1 = (index + 1) / (points.length - 1)
          return {
            ...path,
            axis: 'segment',
            x0: from.x,
            z0: from.z,
            x1: to.x,
            z1: to.z,
            curveOffset0: pathOffset0 + (pathOffset1 - pathOffset0) * t0,
            curveOffset1: pathOffset0 + (pathOffset1 - pathOffset0) * t1,
          }
        })
      })

      for (const segment of boundarySegments) {
        const x0 = segment.x0 * fine
        const x1 = segment.x1 * fine
        const z0 = segment.z0 * fine
        const z1 = segment.z1 * fine
        const frontIsInterior = Number.isFinite(Number(segment.interiorNormalSign))
          ? Number(segment.interiorNormalSign) >= 0
          : segment.axis === 'x'
            ? x1 >= x0
            : segment.axis === 'z'
              ? z1 <= z0
              : true
        const segmentInterior = segment.wallAppearance ? {
          ...interior,
          tex: segment.wallAppearance.interiorTex ?? interior.tex,
          material: segment.wallAppearance.interiorMaterial ?? interior.material,
        } : interior
        const segmentExterior = segmentInterior
        addPanel({
          axis: segment.axis,
          x0,
          x1,
          z0,
          z1,
          frontSource: frontIsInterior ? segmentInterior : segmentExterior,
          backSource: frontIsInterior ? segmentExterior : segmentInterior,
          y,
          curveId: segment.curveId,
          curveArcId: segment.curveArcId,
          curveOffset0: segment.curveOffset0,
          curveOffset1: segment.curveOffset1,
          curveLength: segment.curveLength,
          curveCenterX: segment.centerX ?? segment.curveCenterX,
          curveCenterZ: segment.centerZ ?? segment.curveCenterZ,
          curveRadius: segment.radius ?? segment.curveRadius,
          curveStartAngle: segment.startAngle ?? segment.curveStartAngle,
          curveSweep: segment.sweep ?? segment.curveSweep,
          sourceEdgeKeys: segment.sourceEdgeKeys,
          interiorNormalSign: frontIsInterior ? 1 : -1,
          elevationProfile: segment.elevationProfile,
          elevationProfileFace: frontIsInterior ? 'front' : 'back',
          elevationProfileOriginY: baseY,
          elevationProfileHeight,
        })
      }
    }
  }

  return [...panels.values()].map(completeRoomWallPanel)
}

function mergeStraightWallPanels(panels) {
  const untouched = panels.filter(panel => !['x', 'z'].includes(panel.axis))
  const groups = new Map()
  for (const panel of panels.filter(item => ['x', 'z'].includes(item.axis))) {
    const key = straightWallStyleKey(panel)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(panel)
  }

  const merged = []
  for (const groupedPanels of groups.values()) {
    const axis = groupedPanels[0].axis
    const intervals = groupedPanels.map(panel => {
      const start = axis === 'x' ? Number(panel.x0) : Number(panel.z0)
      const end = axis === 'x' ? Number(panel.x1) : Number(panel.z1)
      return { min: Math.min(start, end), max: Math.max(start, end), panel }
    }).sort((left, right) => left.min - right.min)
    const runs = []
    for (const interval of intervals) {
      const current = runs.at(-1)
      if (current && interval.min <= current.max + 1e-5) {
        current.max = Math.max(current.max, interval.max)
        current.panels.push(interval.panel)
      } else {
        runs.push({ min: interval.min, max: interval.max, panels: [interval.panel] })
      }
    }

    for (const run of runs) {
      const first = run.panels[0]
      const forward = axis === 'x'
        ? Number(first.x1) >= Number(first.x0)
        : Number(first.z1) >= Number(first.z0)
      const start = forward ? run.min : run.max
      const end = forward ? run.max : run.min
      const ids = run.panels.map(panel => panel.id).sort()
      const id = ids.length === 1
        ? first.id
        : `room-wall:run:${axis}:${formatLevel(run.min)}:${formatLevel(run.max)}:${formatLevel(first.y)}:${hashString(ids.join('|'))}`
      merged.push({
        ...first,
        id,
        logicalWallId: id,
        facadeId: `room-wall:facade:${axis}:${formatLevel(axis === 'x' ? first.z0 : first.x0)}:${formatLevel(run.min)}:${formatLevel(run.max)}`,
        ...(axis === 'x' ? { x0: start, x1: end } : { z0: start, z1: end }),
        roomIds: [...new Set(run.panels.flatMap(panel => panel.roomIds || []))],
        frontRoomIds: [...new Set(run.panels.flatMap(panel => panel.frontRoomIds || []))],
        backRoomIds: [...new Set(run.panels.flatMap(panel => panel.backRoomIds || []))],
        sourceEdgeKeys: [...new Set(run.panels.flatMap(panel => panel.sourceEdgeKeys || []))],
        interiorNormalSignsByRoom: Object.assign(
          {},
          ...run.panels.map(panel => panel.interiorNormalSignsByRoom || {}),
        ),
      })
    }
  }
  return [...untouched.map(wall => ({ ...wall, logicalWallId: wall.id })), ...merged]
}

export function roomsWallRenderPaths(rooms) {
  const panels = roomsWallSegments(rooms)
  const straight = mergeStraightWallPanels(panels.filter(panel => !panel.curveId))
  const curveGroups = new Map()
  for (const panel of panels.filter(item => item.curveId)) {
    const key = curveWallStyleKey(panel)
    if (!curveGroups.has(key)) curveGroups.set(key, [])
    curveGroups.get(key).push(panel)
  }

  const arcs = []
  for (const panelsForCurve of curveGroups.values()) {
    const first = panelsForCurve[0]
    const curveLength = Number(first.curveLength)
    if (!Number.isFinite(curveLength) || curveLength <= 1e-7) {
      straight.push(...panelsForCurve)
      continue
    }
    const intervals = panelsForCurve
      .map(panel => {
        const offset0 = Number(panel.curveOffset0)
        const offset1 = Number(panel.curveOffset1)
        const forward = offset0 <= offset1
        return {
          min: Math.min(offset0, offset1),
          max: Math.max(offset0, offset1),
          minPoint: forward
            ? { x: Number(panel.x0), z: Number(panel.z0) }
            : { x: Number(panel.x1), z: Number(panel.z1) },
          maxPoint: forward
            ? { x: Number(panel.x1), z: Number(panel.z1) }
            : { x: Number(panel.x0), z: Number(panel.z0) },
          panel,
        }
      })
      .filter(item => Number.isFinite(item.min) && Number.isFinite(item.max))
      .sort((left, right) => left.min - right.min)
    const runs = []
    for (const interval of intervals) {
      const current = runs.at(-1)
      if (current && interval.min <= current.max + 1e-5) {
        if (interval.max > current.max) {
          current.max = interval.max
          current.maxPoint = interval.maxPoint
        }
        current.roomIds.push(...(interval.panel.roomIds || []))
      } else {
        runs.push({
          min: interval.min,
          max: interval.max,
          minPoint: interval.minPoint,
          maxPoint: interval.maxPoint,
          roomIds: [...(interval.panel.roomIds || [])],
        })
      }
    }
    for (const run of runs) {
      const startProgress = run.min / curveLength
      const endProgress = run.max / curveLength
      const startAngle = Number(first.curveStartAngle) + Number(first.curveSweep) * startProgress
      const sweep = Number(first.curveSweep) * (endProgress - startProgress)
      arcs.push({
        ...first,
        id: `room-wall:arc:${first.curveId}:${formatLevel(run.min)}:${formatLevel(run.max)}:${formatLevel(first.y)}`,
        logicalWallId: `room-wall:arc:${first.curveId}:${formatLevel(run.min)}:${formatLevel(run.max)}:${formatLevel(first.y)}`,
        facadeId: `room-wall:facade:arc:${first.curveId}:${formatLevel(run.min)}:${formatLevel(run.max)}`,
        axis: 'arc',
        curveOffset0: run.min,
        curveOffset1: run.max,
        roomIds: [...new Set(run.roomIds)],
        interiorNormalSignsByRoom: { ...(first.interiorNormalSignsByRoom || {}) },
        centerX: Number(first.curveCenterX),
        centerZ: Number(first.curveCenterZ),
        radius: Number(first.curveRadius),
        startAngle,
        sweep,
        x0: run.minPoint.x,
        z0: run.minPoint.z,
        x1: run.maxPoint.x,
        z1: run.maxPoint.z,
      })
    }
  }
  return withWallCornerJoins([...straight, ...arcs], wall => wall.roomIds)
}

export function roomWallSegments(room, roomLookup = null) {
  if (!room) return []
  const roomId = room.id || 'room'
  const rooms = roomLookup || { [roomId]: room }
  return roomsWallSegments(rooms).filter(wall => wall.roomIds?.includes(roomId))
}