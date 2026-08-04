// connectors.js — Création de connecteurs (portes, ascenseurs, échelles)
// Extrait de surfaceData.js, Lot 3a du PLAN_REFACTOR_SURFACE.md

import { clampNumber, formatLevel, sameLevel } from './surfaceUtils.js'
import {
  STORY_HEIGHT,
  levelToY,
  getRoomFloorThickness,
  SURFACE_FINE,
  getToolLevel,
  getToolMovementMultiplier,
  getToolFloorThickness,
  getFloorThickness,
  floorKey,
  normalizeSurfaceData,
  roomIncludesCell,
} from './surfaceCore.js'
import { findRoomAtCell } from './surfaceRooms.js'
import { wallPointDistanceToPanel, roomsWallSegments } from './roomWalls.js'

// ----- Connecteur : blocage -----

export function connectorCommonBlocking(type, state = 'closed') {
  if (type === 'elevator') {
    return {
      blocksSight: false,
      blocksMovement: false,
      blocksWater: true,
      barrierType: 'connector',
    }
  }
  if (type === 'ladder') {
    return {
      blocksSight: false,
      blocksMovement: false,
      blocksWater: false,
      barrierType: 'connector',
    }
  }
  const open = state === 'open'
  return {
    blocksSight: !open,
    blocksMovement: !open,
    blocksWater: !open,
    barrierType: open ? 'open-door' : 'door',
  }
}

// ----- Connecteur : modèle -----

export function connectorModelFromTool(tool) {
  const modelBlueprintId = tool?.connectorBlueprintId || tool?.connectorModelBlueprintId || null
  const modelLabel = tool?.connectorModelLabel || null
  const modelCategory = tool?.connectorModelCategory || null
  const modelGlbUrl = tool?.connectorModelGlbUrl || null
  const modelBuiltinKey = tool?.connectorModelBuiltinKey || null
  const modelGeometry = tool?.connectorModelGeometry && typeof tool.connectorModelGeometry === 'object'
    ? tool.connectorModelGeometry
    : null
  const modelMaterialOverrides = (
    tool?.connectorMaterialOverrides
    || tool?.connectorModelMaterialOverrides
    || tool?.modelMaterialOverrides
  )
  const hasMaterialOverrides = modelMaterialOverrides
    && typeof modelMaterialOverrides === 'object'
    && Object.keys(modelMaterialOverrides).length > 0
  if (!modelBlueprintId && !modelLabel && !modelCategory && !modelGlbUrl && !modelBuiltinKey && !modelGeometry && !hasMaterialOverrides) return {}
  return {
    modelBlueprintId,
    modelLabel,
    modelCategory,
    modelGlbUrl,
    modelBuiltinKey,
    modelGeometry,
    modelMaterialOverrides: hasMaterialOverrides ? modelMaterialOverrides : {},
  }
}

export function connectorModelGeometryFromTool(tool) {
  return tool?.connectorModelGeometry && typeof tool.connectorModelGeometry === 'object'
    ? tool.connectorModelGeometry
    : {}
}

function inferredFuturisticDoorBorderFromTool(tool) {
  const key = String(tool?.connectorModelBuiltinKey || '').toLowerCase()
  if (!key.includes('futuristic_doors')) return 0
  if (key.includes('02_airlock')) return 0.23
  if (key.includes('06_large_hangar')) return 0.34
  if (key.includes('07_large_glass_hangar')) return 0.38
  if (key.includes('08_three_part')) return 0.2
  return 0.18
}

export function connectorModelOuterWidthFromTool(tool, modelGeometry) {
  const explicitCut = Number(modelGeometry.wallCutWidth || modelGeometry.footprintWidth || modelGeometry.footprint_width_m)
  if (explicitCut) return Math.max(0.25, explicitCut)

  const declaredWidth = Math.max(0.25, Number(modelGeometry.width) || 1)
  const openingWidth = Number(modelGeometry.openingWidth || modelGeometry.doorPanelWidth || modelGeometry.door_panel_width_m)
  if (openingWidth && declaredWidth > openingWidth + 0.01) return declaredWidth

  const border = inferredFuturisticDoorBorderFromTool(tool)
  return declaredWidth + border * 2
}

// ----- Utilitaires locaux -----

function clampPointOnPanel(value, min, max) {
  return clampNumber(value, min, max, (min + max) / 2)
}

function normalizeDoorRotation(value) {
  const halfTurn = Math.PI
  const normalized = ((Number(value) % halfTurn) + halfTurn) % halfTurn
  return Math.abs(normalized - halfTurn) < 1e-8 ? 0 : normalized
}

function supportTopAt(surface, cell, level, fallbackThickness) {
  const roomHit = findRoomAtCell(surface, cell, level)
  if (roomHit?.room) return levelToY(level) + getRoomFloorThickness(roomHit.room) / 2
  const floor = surface.floors?.[floorKey(cell.x, cell.z, levelToY(level))]
  return levelToY(level) + (floor ? getFloorThickness(floor) : fallbackThickness) / 2
}

// ----- Porte -----

export function makeDoorConnectorFromWallPoint(surfaceData, wallPoint, tool = {}) {
  if (!wallPoint) return null
  const surface = normalizeSurfaceData(surfaceData)
  const level = getToolLevel(tool)
  const y = levelToY(level)
  const selectedRoomId = tool?.selectedRoomId || null
  const allowedWallEdgeKeys = new Set((tool?.connectorWallEdgeKeys || []).map(String))
  let best = null

  for (const panel of roomsWallSegments(surface.rooms)) {
    if (!sameLevel(panel.y, y)) continue
    if (selectedRoomId && !panel.roomIds?.includes(selectedRoomId)) continue
    if (allowedWallEdgeKeys.size > 0
      && !(panel.sourceEdgeKeys || []).some(key => allowedWallEdgeKeys.has(String(key)))) continue
    const projection = wallPointDistanceToPanel(wallPoint, panel)
    if (!projection || projection.distance > SURFACE_FINE * 0.5) continue
    if (best && projection.distance >= best.distance) continue
    best = { panel, ...projection }
  }

  if (!best?.panel) return null
  const panel = best.panel
  const state = tool?.connectorState || 'closed'
  const modelGeometry = connectorModelGeometryFromTool(tool)
  const modelWidth = connectorModelOuterWidthFromTool(tool, modelGeometry)
  const modelDepth = Math.max(0.05, Number(modelGeometry.depth) || 0.25)
  const modelHeight = Math.max(0.5, Number(modelGeometry.height) || Math.min(2, STORY_HEIGHT * 0.9))
  const doorLengthFine = modelWidth * SURFACE_FINE
  if (panel.axis === 'segment') {
    const curveOffset = Number.isFinite(Number(panel.curveOffset0)) && Number.isFinite(Number(panel.curveOffset1))
      ? Number(panel.curveOffset0) + (Number(panel.curveOffset1) - Number(panel.curveOffset0)) * best.t
      : null
    const hasCanonicalArc = curveOffset !== null
      && Number.isFinite(Number(panel.curveLength))
      && Number(panel.curveLength) > 1e-8
      && [panel.curveCenterX, panel.curveCenterZ, panel.curveRadius, panel.curveStartAngle, panel.curveSweep]
        .every(value => Number.isFinite(Number(value)))
    const curveAngle = hasCanonicalArc
      ? Number(panel.curveStartAngle) + Number(panel.curveSweep) * (curveOffset / Number(panel.curveLength))
      : null
    const sweepSign = Math.sign(Number(panel.curveSweep)) || 1
    const rawDx = hasCanonicalArc ? -Math.sin(curveAngle) * sweepSign : Number(panel.x1) - Number(panel.x0)
    const rawDz = hasCanonicalArc ? Math.cos(curveAngle) * sweepSign : Number(panel.z1) - Number(panel.z0)
    const rotationY = normalizeDoorRotation(-Math.atan2(rawDz, rawDx))
    const tangentX = Math.cos(rotationY)
    const tangentZ = -Math.sin(rotationY)
    const normalX = -tangentZ
    const normalZ = tangentX
    const centerX = hasCanonicalArc
      ? (Number(panel.curveCenterX) + Math.cos(curveAngle) * Number(panel.curveRadius)) * SURFACE_FINE
      : best.projectedFx
    const centerZ = hasCanonicalArc
      ? (Number(panel.curveCenterZ) + Math.sin(curveAngle) * Number(panel.curveRadius)) * SURFACE_FINE
      : best.projectedFz
    const x0 = centerX - tangentX * doorLengthFine / 2
    const x1 = centerX + tangentX * doorLengthFine / 2
    const z0 = centerZ - tangentZ * doorLengthFine / 2
    const z1 = centerZ + tangentZ * doorLengthFine / 2
    const id = `connector:door:segment:${formatLevel(centerX)}:${formatLevel(centerZ)}:${formatLevel(panel.y)}`
    return {
      id,
      type: 'door',
      level,
      y: panel.y,
      axis: 'segment',
      x0,
      x1,
      z0,
      z1,
      anchorX: centerX / SURFACE_FINE,
      anchorZ: centerZ / SURFACE_FINE,
      tangentX,
      tangentZ,
      normalX,
      normalZ,
      rotationY,
      curveId: panel.curveId || null,
      curveArcId: panel.curveArcId || null,
      curveOffset,
      curveLength: panel.curveLength,
      thickness: panel.thickness,
      width: modelWidth,
      depth: modelDepth,
      height: modelHeight,
      roomId: selectedRoomId || panel.roomIds?.[0] || null,
      roomIds: panel.roomIds || [],
      state,
      movementMultiplier: getToolMovementMultiplier(tool),
      ...connectorModelFromTool(tool),
      ...connectorCommonBlocking('door', state),
    }
  }
  const panelMin = panel.axis === 'x'
    ? Math.min(Number(panel.x0), Number(panel.x1))
    : Math.min(Number(panel.z0), Number(panel.z1))
  const panelMax = panel.axis === 'x'
    ? Math.max(Number(panel.x0), Number(panel.x1))
    : Math.max(Number(panel.z0), Number(panel.z1))
  const clickAlong = panel.axis === 'x' ? Number(wallPoint.fx) : Number(wallPoint.fz)
  const center = clampPointOnPanel(clickAlong, panelMin, panelMax)
  const doorMin = center - doorLengthFine / 2
  const doorMax = center + doorLengthFine / 2
  const x0 = panel.axis === 'x' ? doorMin : panel.x0
  const x1 = panel.axis === 'x' ? doorMax : panel.x1
  const z0 = panel.axis === 'z' ? doorMin : panel.z0
  const z1 = panel.axis === 'z' ? doorMax : panel.z1
  const id = `connector:door:${panel.axis}:${formatLevel(x0)}:${formatLevel(z0)}:${formatLevel(x1)}:${formatLevel(z1)}:${formatLevel(panel.y)}`
  return {
    id,
    type: 'door',
    level,
    y: panel.y,
    axis: panel.axis,
    x0,
    x1,
    z0,
    z1,
    alongCenter: center,
    thickness: panel.thickness,
    width: modelWidth,
    depth: modelDepth,
    height: modelHeight,
    roomId: selectedRoomId || panel.roomIds?.[0] || null,
    roomIds: panel.roomIds || [],
    state,
    movementMultiplier: getToolMovementMultiplier(tool),
    ...connectorModelFromTool(tool),
    ...connectorCommonBlocking('door', state),
  }
}

export function applyDoorConnector(surfaceData, wallPoint, tool = {}) {
  const connector = makeDoorConnectorFromWallPoint(surfaceData, wallPoint, tool)
  if (!connector) return surfaceData
  const next = normalizeSurfaceData(surfaceData)
  return {
    ...next,
    connectors: {
      ...next.connectors,
      [connector.id]: connector,
    },
  }
}

// ----- Ascenseur -----

export function makeElevatorConnectorFromCell(surfaceData, cell, tool = {}) {
  if (!cell) return null
  const surface = normalizeSurfaceData(surfaceData)
  const fromLevel = getToolLevel(tool)
  const selectedRoomId = tool?.selectedRoomId || null
  const hit = selectedRoomId && surface.rooms?.[selectedRoomId]
      ? (() => {
        const room = { id: selectedRoomId, ...surface.rooms[selectedRoomId] }
        return roomIncludesCell(room, cell.x, cell.z)
          ? { id: selectedRoomId, room }
          : null
      })()
    : findRoomAtCell(surface, cell, fromLevel)
  if (!hit?.room) return null

  const toLevel = Number.isFinite(Number(tool?.connectorToLevel))
    ? Number(tool.connectorToLevel)
    : fromLevel + 1
  const minLevel = Math.min(fromLevel, toLevel)
  const maxLevel = Math.max(fromLevel, toLevel)
  const stops = Array.from({ length: maxLevel - minLevel + 1 }, (_, index) => {
    const stopLevel = minLevel + index
    return {
      id: `level:${stopLevel}`,
      level: stopLevel,
      y: supportTopAt(surface, cell, stopLevel, getToolFloorThickness(tool)),
      label: `Étage ${stopLevel}`,
    }
  })
  const id = `connector:elevator:${cell.x}:${cell.z}:${minLevel}:${maxLevel}`
  return {
    id,
    type: 'elevator',
    roomId: hit.id,
    roomIds: [hit.id],
    x: cell.x,
    z: cell.z,
    level: fromLevel,
    fromLevel,
    toLevel,
    initialStopId: `level:${fromLevel}`,
    stops,
    y: stops[0].y,
    topY: stops.at(-1).y + STORY_HEIGHT,
    width: 1,
    depth: 1,
    cabinHeight: Math.min(2.2, STORY_HEIGHT * 0.88),
    cabinFloorThickness: 0.12,
    cabinWallThickness: 0.08,
    doorAxis: tool?.elevatorDoorAxis === 'x' ? 'x' : 'z',
    doorSide: Number(tool?.elevatorDoorSide) < 0 ? -1 : 1,
    travelSecondsPerLevel: Math.max(0.1, Number(tool?.elevatorTravelSecondsPerLevel) || 2),
    doorSeconds: Math.max(0.1, Number(tool?.elevatorDoorSeconds) || 0.75),
    dwellSeconds: Math.max(0.1, Number(tool?.elevatorDwellSeconds) || 0.75),
    state: 'ready',
    movementMultiplier: getToolMovementMultiplier(tool),
    ...connectorModelFromTool(tool),
    ...connectorCommonBlocking('elevator'),
  }
}

export function applyElevatorConnector(surfaceData, cell, tool = {}) {
  const connector = makeElevatorConnectorFromCell(surfaceData, cell, tool)
  if (!connector) return surfaceData
  const next = normalizeSurfaceData(surfaceData)
  return {
    ...next,
    connectors: {
      ...next.connectors,
      [connector.id]: connector,
    },
  }
}

// ----- Échelle -----

export function makeLadderConnectorFromCell(surfaceData, cell, tool = {}) {
  if (!cell) return null
  const surface = normalizeSurfaceData(surfaceData)
  const fromLevel = getToolLevel(tool)
  const toLevel = Number.isFinite(Number(tool?.connectorToLevel))
    ? Math.trunc(Number(tool.connectorToLevel))
    : fromLevel + 1
  if (toLevel === fromLevel) return null
  const fallbackThickness = getToolFloorThickness(tool)
  const fromY = supportTopAt(surface, cell, fromLevel, fallbackThickness)
  const toY = supportTopAt(surface, cell, toLevel, fallbackThickness)
  const roomHit = findRoomAtCell(surface, cell, fromLevel)
  const minLevel = Math.min(fromLevel, toLevel)
  const maxLevel = Math.max(fromLevel, toLevel)
  const id = `connector:ladder:${cell.x}:${cell.z}:${minLevel}:${maxLevel}`
  return {
    id,
    type: 'ladder',
    roomId: roomHit?.id || null,
    roomIds: roomHit?.id ? [roomHit.id] : [],
    x: cell.x,
    z: cell.z,
    level: fromLevel,
    fromLevel,
    toLevel,
    fromY,
    toY,
    y: Math.min(fromY, toY),
    topY: Math.max(fromY, toY),
    width: Math.max(0.2, Number(tool?.ladderWidth) || 0.7),
    depth: Math.max(0.05, Number(tool?.ladderDepth) || 0.12),
    height: Math.abs(toY - fromY),
    axis: tool?.ladderAxis === 'z' ? 'z' : 'x',
    state: 'ready',
    walkable: true,
    movementMode: 'climb',
    movementMultiplier: getToolMovementMultiplier(tool),
    allowPartial: true,
    anchorSpacing: Math.max(0.1, Number(tool?.ladderAnchorSpacing) || 0.5),
    ...connectorModelFromTool(tool),
    ...connectorCommonBlocking('ladder'),
  }
}

export function applyLadderConnector(surfaceData, cell, tool = {}) {
  const connector = makeLadderConnectorFromCell(surfaceData, cell, tool)
  if (!connector) return surfaceData
  const next = normalizeSurfaceData(surfaceData)
  return {
    ...next,
    connectors: {
      ...next.connectors,
      [connector.id]: connector,
    },
  }
}