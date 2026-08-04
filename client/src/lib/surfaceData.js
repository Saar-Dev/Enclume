// surfaceData.js — Transformations de surface_data v12
// Refactor PLAN_REFACTOR_SURFACE.md — Lots 1 à 7
// Les constantes, la forme du document et les getters de base sont dans surfaceCore.js
// (aucun module métier ci-dessous ne dépend de ce barrel — voir surfaceCore.js).
// Les fonctions de décision de matériau sont dans materialDecision.js
// Les fonctions utilitaires partagées sont dans surfaceUtils.js
// Les fonctions de géométrie de mur sont dans surfaceGeometry.js
// Les fonctions de gestion de pièces sont dans surfaceRooms.js
// Les fonctions de connecteurs sont dans connectors.js
// Les fonctions d'assemblage de murs de pièces sont dans roomWalls.js
// Les fonctions d'escaliers sont dans surfaceStairs.js

import {
  intersectMultiPolygons,
  multiPolygonArea,
  multiPolygonGridCells,
  roomBoundaryEdges,
  roomBoundaryWallRuns,
  roomCeilingRegions,
  roomEffectiveGridCells,
  roomInteriorFootprintAtY,
  roomSliceAtLevel,
  roomVolumeContainsPoint,
} from '../../../shared/world/roomGeometry.js'

import { SURFACE_DATA_VERSION } from '../../../shared/world/surfaceDocument.js'
import { formatLevel, sameLevel } from './surfaceUtils.js'
import {
  surfaceBlockingForTool,
  materialOrTextureForTool,
  toolForMaterialFace,
} from './materialDecision.js'
import {
  STORY_HEIGHT,
  levelToY,
  yToLevel,
  getRoomBaseY,
  SURFACE_FINE,
  normalizeSurfaceData,
  normalizeCellSelection,
  getToolElevation,
  getToolFloorThickness,
  getToolCeilingThickness,
  getToolCeilingHeight,
  getToolMovementMultiplier,
  floorKey,
  parseFloorKey,
  ceilingKey,
  parseCeilingKey,
  getRoomFootprintCells,
  roomCellKey,
  getRoomTopY,
  getRoomFloorThickness,
  getRoomCeilingThickness,
} from './surfaceCore.js'
import {
  roomsWallSegments,
  addMissingWalls,
} from './roomWalls.js'
import {
  getWallFineBounds,
} from './surfaceGeometry.js'

export { SURFACE_DATA_VERSION }
export const getRoomBoundaryEdges = roomBoundaryEdges
export const getRoomBoundaryWallRuns = roomBoundaryWallRuns

// ===================================================================
// Réexports pour compatibilité (consommateurs existants)
// ===================================================================

export { hashString, clampNumber, formatLevel, sameLevel } from './surfaceUtils.js'
export {
  surfaceBlockingForTool,
  materialOrTextureForTool,
  toolForMaterialFace,
} from './materialDecision.js'
export { getWallFineBounds, getWallRenderBox, makeWallsFromDrag } from './surfaceGeometry.js'
export {
  findRoomAtCell,
  findRoomsInSelection,
  getRoomBounds,
  makeRoomFromSelection,
  applyRoomSelection,
  applyRoomSelectionWithResult,
  applyRoomToolUpdate,
  deleteSurfaceRoom,
  deleteRoomBoundaryWalls,
  applyRoomBoundaryArc,
  removeRoomBoundaryArcs,
  applyRoomWallElevationProfile,
  applyRoomWallAppearance,
  roomToSurfaceToolPatch,
} from './surfaceRooms.js'
export {
  makeStairFromSelection,
  stairStepBoxes,
  applyStairSelection,
} from './surfaceStairs.js'
export {
  connectorCommonBlocking,
  connectorModelFromTool,
  connectorModelGeometryFromTool,
  connectorModelOuterWidthFromTool,
  makeDoorConnectorFromWallPoint,
  applyDoorConnector,
  makeElevatorConnectorFromCell,
  applyElevatorConnector,
  makeLadderConnectorFromCell,
  applyLadderConnector,
} from './connectors.js'
export { roomsWallSegments, addMissingWalls, roomsWallRenderPaths } from './roomWalls.js'
export {
  STORY_HEIGHT,
  levelToY,
  yToLevel,
  getRoomBaseY,
  getRoomHeightLevels,
  SURFACE_FINE,
  DEFAULT_SURFACE_DATA,
  normalizeSurfaceData,
  normalizeCellSelection,
  getToolElevation,
  getToolLevel,
  getToolRoomHeightLevels,
  getToolWallHeightLevels,
  getToolFloorThickness,
  getToolCeilingThickness,
  getToolCeilingHeight,
  getToolStairRise,
  getToolMovementMultiplier,
  getFloorThickness,
  getCeilingThickness,
  getFloorTopY,
  getSupportThickness,
  floorKey,
  parseFloorKey,
  ceilingKey,
  parseCeilingKey,
  roomCellKey,
  getRoomFootprintCells,
  roomIncludesCell,
  getRoomFloorThickness,
  getRoomCeilingThickness,
  getRoomHeight,
  getRoomTopY,
} from './surfaceCore.js'

// ===================================================================
// Grille et recherche spatiale locale
// ===================================================================

export function roomFootprintRectangles(room) {
  const cells = getRoomFootprintCells(room)
  const available = new Set(cells.map(cell => roomCellKey(cell.x, cell.z)))
  const used = new Set()
  const rectangles = []
  for (const cell of cells) {
    const startKey = roomCellKey(cell.x, cell.z)
    if (used.has(startKey)) continue
    let width = 1
    while (available.has(roomCellKey(cell.x + width, cell.z)) && !used.has(roomCellKey(cell.x + width, cell.z)))
      width += 1
    let depth = 1
    let canGrow = true
    while (canGrow) {
      for (let dx = 0; dx < width; dx += 1) {
        const key = roomCellKey(cell.x + dx, cell.z + depth)
        if (!available.has(key) || used.has(key)) { canGrow = false; break }
      }
      if (canGrow) depth += 1
    }
    for (let dz = 0; dz < depth; dz += 1)
      for (let dx = 0; dx < width; dx += 1)
        used.add(roomCellKey(cell.x + dx, cell.z + dz))
    rectangles.push({ minX: cell.x, maxX: cell.x + width - 1, minZ: cell.z, maxZ: cell.z + depth - 1, width, depth })
  }
  return rectangles
}

// ===================================================================
// Normalisation et utilitaires
// ===================================================================

export function hasSurfaceContent(data) {
  const surface = normalizeSurfaceData(data)
  return Object.keys(surface.rooms).length > 0
    || Object.keys(surface.floors).length > 0
    || Object.keys(surface.walls).length > 0
    || Object.keys(surface.ceilings).length > 0
    || Object.keys(surface.stairs).length > 0
    || Object.keys(surface.connectors).length > 0
}

export function computeSurfaceGridExtent(data, { min = 20, max = 50, margin = 4 } = {}) {
  const surface = normalizeSurfaceData(data)
  let farthest = 0
  for (const [id, floor] of Object.entries(surface.floors)) {
    const { x, z } = parseFloorKey(id, floor)
    farthest = Math.max(farthest, Math.abs(x), Math.abs(z))
  }
  const half = Math.max(min / 2, farthest + margin)
  return Math.min(max, half * 2)
}

export function surfaceTextureIds(data) {
  const surface = normalizeSurfaceData(data)
  const ids = new Set()
  for (const floor of Object.values(surface.floors)) {
    if (floor?.tex) ids.add(floor.tex)
    if (floor?.topTex) ids.add(floor.topTex)
    if (floor?.bottomTex) ids.add(floor.bottomTex)
  }
  for (const wall of Object.values(surface.walls)) {
    if (wall?.frontTex) ids.add(wall.frontTex)
    if (wall?.backTex) ids.add(wall.backTex)
    if (wall?.topTex) ids.add(wall.topTex)
  }
  for (const ceiling of Object.values(surface.ceilings)) {
    if (ceiling?.tex) ids.add(ceiling.tex)
    if (ceiling?.topTex) ids.add(ceiling.topTex)
    if (ceiling?.bottomTex) ids.add(ceiling.bottomTex)
  }
  for (const stair of Object.values(surface.stairs)) {
    if (stair?.tex) ids.add(stair.tex)
  }
  for (const room of Object.values(surface.rooms)) {
    if (room?.floorTex) ids.add(room.floorTex)
    if (room?.ceilingTex) ids.add(room.ceilingTex)
    if (room?.wallInteriorTex) ids.add(room.wallInteriorTex)
  }
  return [...ids]
}

// ===================================================================
// Getters de salle locaux
// ===================================================================

export function getRoomSlice(room, displayLevel, roomLookup = {}) {
  const baseLevel = yToLevel(getRoomBaseY(room))
  return roomSliceAtLevel(room, Number(displayLevel) - baseLevel, roomLookup, STORY_HEIGHT)
}

export function isWorldPointVisibleAtLevel(data, displayLevel, x, z, y, cameraRoomId = null) {
  if (displayLevel === null || displayLevel === undefined) return true
  if (yToLevel(y) <= displayLevel) return true
  const room = cameraRoomId ? data?.rooms?.[cameraRoomId] : null
  if (!room) return false
  return roomVolumeContainsPoint({ id: cameraRoomId, ...room }, { x, y, z }, data.rooms, STORY_HEIGHT)
}

// ===================================================================
// Profils de mur
// ===================================================================

export function wallProfileVerticalProgresses(wall, start = 0, end = 1) {
  const neighbors = [
    wall?.profileJoinStart?.front?.neighbor,
    wall?.profileJoinStart?.back?.neighbor,
    wall?.profileJoinEnd?.front?.neighbor,
    wall?.profileJoinEnd?.back?.neighbor,
    wall?.profileJoinStart?.neighbor,
    wall?.profileJoinEnd?.neighbor,
  ].filter(Boolean)
  const influences = [wall, ...neighbors]
  const profileTypes = influences.flatMap(item => [
    item?.elevationProfile?.type,
    item?.frontElevationProfile?.type,
    item?.backElevationProfile?.type,
  ])
  const from = Math.max(0, Math.min(1, Number(start) || 0))
  const to = Math.max(from, Math.min(1, Number(end) || 0))
  const curveLevelCount = Math.max(2, Math.ceil((to - from) * 12) + 1)
  const levels = profileTypes.includes('curved')
    ? Array.from({ length: curveLevelCount }, (_, index) => from + (to - from) * index / Math.max(1, curveLevelCount - 1))
    : [from, to]
  if (profileTypes.includes('faceted') && from < 0.5 && to > 0.5) levels.push(0.5)
  return [...new Set(levels)].sort((left, right) => left - right)
}

// ===================================================================
// Expansion pièces → surfaces
// ===================================================================

export function expandRoomsToSurface(data) {
  const surface = normalizeSurfaceData(data)
  const floors = { ...surface.floors }
  const ceilings = { ...surface.ceilings }
  const walls = { ...surface.walls }
  for (const room of Object.values(surface.rooms)) {
    const footprint = roomEffectiveGridCells(room, surface.rooms)
    const baseY = getRoomBaseY(room)
    const blocking = {
      barrierType: room.barrierType,
      blocksSight: room.blocksSight,
      blocksMovement: room.blocksMovement,
      blocksWater: room.blocksWater,
    }
    if (room.floorEnabled !== false) {
      for (const { x, z } of footprint) {
        const id = floorKey(x, z, baseY)
        if (!floors[id]) {
          floors[id] = {
            y: baseY,
            thickness: getRoomFloorThickness(room),
            topTex: room.floorTex,
            bottomTex: room.floorTex,
            topMaterial: room.floorMaterial,
            bottomMaterial: room.floorMaterial,
            ...blocking,
          }
        }
      }
    }
    if (room.ceilingEnabled !== false) {
      for (const region of roomCeilingRegions(room, surface.rooms, STORY_HEIGHT)) {
        const topY = baseY + region.topOffset * STORY_HEIGHT
        for (const { x, z } of multiPolygonGridCells(region.footprint)) {
          const id = ceilingKey(x, z, baseY, topY)
          if (!ceilings[id]) {
            ceilings[id] = {
              baseY,
              y: topY,
              thickness: getRoomCeilingThickness(room),
              topTex: room.ceilingTex,
              bottomTex: room.ceilingTex,
              material: room.ceilingMaterial,
              topMaterial: room.ceilingMaterial,
              bottomMaterial: room.ceilingMaterial,
              ...blocking,
            }
          }
        }
      }
    }
  }
  addMissingWalls(walls, roomsWallSegments(surface.rooms))
  return { ...surface, floors, ceilings, walls }
}

// ===================================================================
// apply* : sols, plafonds, ponts
// ===================================================================

export function applyFloorSelection(surfaceData, selection, tool, activeMaterial, availableBlocks) {
  const area = normalizeCellSelection(selection)
  if (!area) return surfaceData
  const next = normalizeSurfaceData(surfaceData)
  const floors = { ...next.floors }
  const y = getToolElevation(tool)
  const thickness = getToolFloorThickness(tool)
  let changed = false
  for (let x = area.minX; x <= area.maxX; x += 1) {
    for (let z = area.minZ; z <= area.maxZ; z += 1) {
      const top = materialOrTextureForTool({
        tool: toolForMaterialFace(tool, 'floor'),
        packId: tool?.floorPackId,
        textureId: tool?.floorTexId,
        fallbackTexId: activeMaterial?.texId,
        availableBlocks,
        seed: `floor:${x}:${z}:${formatLevel(y)}`,
      })
      const bottom = materialOrTextureForTool({
        tool: toolForMaterialFace(tool, 'ceiling'),
        packId: tool?.ceilingPackId || tool?.floorPackId,
        textureId: tool?.ceilingTexId || tool?.floorTexId,
        fallbackTexId: top.tex || activeMaterial?.texId,
        availableBlocks,
        seed: `floor-bottom:${x}:${z}:${formatLevel(y)}`,
      })
      if (!top.tex && !top.material) continue
      const resolvedBottom = bottom.tex || bottom.material ? bottom : top
      floors[floorKey(x, z, y)] = {
        ...(top.tex ? { topTex: top.tex } : {}),
        ...(resolvedBottom.tex ? { bottomTex: resolvedBottom.tex } : {}),
        ...(top.material ? { topMaterial: top.material } : {}),
        ...(resolvedBottom.material ? { bottomMaterial: resolvedBottom.material } : {}),
        y,
        level: yToLevel(y),
        thickness,
        walkable: true,
        movementMultiplier: getToolMovementMultiplier(tool),
        ...surfaceBlockingForTool(tool),
      }
      changed = true
    }
  }
  return changed ? { ...next, floors } : surfaceData
}

export function applyBridgeSelection(surfaceData, selection, tool, activeMaterial, availableBlocks) {
  const area = normalizeCellSelection(selection)
  if (!area) return surfaceData
  const withFloors = applyFloorSelection(surfaceData, selection, tool, activeMaterial, availableBlocks)
  if (withFloors === surfaceData) return surfaceData
  const next = normalizeSurfaceData(withFloors)
  const floors = { ...next.floors }
  const y = getToolElevation(tool)
  const level = yToLevel(y)
  for (let x = area.minX; x <= area.maxX; x += 1) {
    for (let z = area.minZ; z <= area.maxZ; z += 1) {
      const key = floorKey(x, z, y)
      if (!floors[key]) continue
      const tileFootprint = [[[[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1], [x, z]]]]
      let clippingRoomId = null
      let clippingArea = 0
      for (const [roomId, rawRoom] of Object.entries(next.rooms || {})) {
        const room = { id: roomId, ...rawRoom }
        const baseLevel = yToLevel(getRoomBaseY(room))
        if (!roomSliceAtLevel(room, level - baseLevel, next.rooms, STORY_HEIGHT)) continue
        const interior = roomInteriorFootprintAtY(room, y, next.rooms, STORY_HEIGHT)
        const overlapArea = multiPolygonArea(intersectMultiPolygons(tileFootprint, interior))
        if (overlapArea <= 1e-6 || overlapArea <= clippingArea) continue
        clippingRoomId = roomId
        clippingArea = overlapArea
      }
      floors[key] = {
        ...floors[key],
        kind: 'bridge',
        structuralKind: 'bridge',
        runtimeSupport: true,
        movementMultiplier: getToolMovementMultiplier(tool),
        ...(clippingRoomId ? { clipRoomId: clippingRoomId } : {}),
      }
    }
  }
  return { ...next, floors }
}

export function applyCeilingSelection(surfaceData, selection, tool, activeMaterial, availableBlocks) {
  const area = normalizeCellSelection(selection)
  if (!area) return surfaceData
  const next = normalizeSurfaceData(surfaceData)
  const ceilings = { ...next.ceilings }
  const baseY = getToolElevation(tool)
  const y = baseY + getToolCeilingHeight(tool)
  const thickness = getToolCeilingThickness(tool)
  let changed = false
  for (let x = area.minX; x <= area.maxX; x += 1) {
    for (let z = area.minZ; z <= area.maxZ; z += 1) {
      const id = ceilingKey(x, z, baseY, y)
      const { tex, material } = materialOrTextureForTool({
        tool,
        packId: tool?.ceilingPackId || tool?.floorPackId,
        textureId: tool?.ceilingTexId || tool?.floorTexId,
        fallbackTexId: activeMaterial?.texId,
        availableBlocks,
        seed: `ceiling:${x}:${z}:${formatLevel(baseY)}:${formatLevel(y)}`,
      })
      if (!tex && !material) continue
      ceilings[id] = {
        ...(tex ? { tex } : {}),
        ...(material ? { material } : {}),
        baseY,
        y,
        thickness,
        walkable: false,
        ...surfaceBlockingForTool(tool),
      }
      changed = true
    }
  }
  return changed ? { ...next, ceilings } : surfaceData
}

// ===================================================================
// Effacement
// ===================================================================

function rangesIntersect(aMin, aMax, bMin, bMax) {
  return aMax >= bMin && bMax >= aMin
}

function cellAreaIntersectsBounds(bounds, area) {
  return rangesIntersect(bounds.minX, bounds.maxX + 1, area.minX, area.maxX + 1)
    && rangesIntersect(bounds.minZ, bounds.maxZ + 1, area.minZ, area.maxZ + 1)
}

function wallIntersectsCellArea(wall, area) {
  const fine = SURFACE_FINE
  const minFx = area.minX * fine
  const maxFx = (area.maxX + 1) * fine
  const minFz = area.minZ * fine
  const maxFz = (area.maxZ + 1) * fine
  const bounds = getWallFineBounds(wall)
  if (!bounds) return false
  return rangesIntersect(bounds.minX, bounds.maxX, minFx, maxFx)
    && rangesIntersect(bounds.minZ, bounds.maxZ, minFz, maxFz)
}

function connectorIntersectsCellArea(connector, area) {
  if (!connector) return false
  if (connector.type === 'door') return wallIntersectsCellArea(connector, area)
  const x = Math.trunc(Number(connector.x) || 0)
  const z = Math.trunc(Number(connector.z) || 0)
  const width = Math.max(1, Math.trunc(Number(connector.width) || 1))
  const depth = Math.max(1, Math.trunc(Number(connector.depth) || 1))
  return rangesIntersect(x, x + width - 1, area.minX, area.maxX)
    && rangesIntersect(z, z + depth - 1, area.minZ, area.maxZ)
}

export function eraseSurfaceSelection(surfaceData, selection, tool) {
  const area = normalizeCellSelection(selection)
  if (!area) return surfaceData
  const next = normalizeSurfaceData(surfaceData)
  const targetY = getToolElevation(tool)
  const floors = { ...next.floors }
  const walls = { ...next.walls }
  const ceilings = { ...next.ceilings }
  const stairs = { ...next.stairs }
  const rooms = { ...next.rooms }
  const connectors = { ...next.connectors }
  let changed = false

  for (const [id, room] of Object.entries(next.rooms)) {
    const baseY = getRoomBaseY(room)
    const topY = getRoomTopY(room)
    const matchesLevel = targetY >= baseY - 0.001 && targetY <= topY + 0.001
    const contained = getRoomFootprintCells(room).every(cell =>
      cell.x >= area.minX && cell.x <= area.maxX && cell.z >= area.minZ && cell.z <= area.maxZ
    )
    if (matchesLevel && contained) { delete rooms[id]; changed = true }
  }

  for (const [id, floor] of Object.entries(next.floors)) {
    const parsed = parseFloorKey(id, floor)
    if (parsed.x >= area.minX && parsed.x <= area.maxX && parsed.z >= area.minZ && parsed.z <= area.maxZ && sameLevel(parsed.y, targetY)) {
      delete floors[id]; changed = true
    }
  }

  for (const [id, wall] of Object.entries(next.walls)) {
    if (sameLevel(wall?.y, targetY) && wallIntersectsCellArea(wall, area)) { delete walls[id]; changed = true }
  }

  for (const [id, ceiling] of Object.entries(next.ceilings)) {
    const parsed = parseCeilingKey(id, ceiling)
    if (parsed.x >= area.minX && parsed.x <= area.maxX && parsed.z >= area.minZ && parsed.z <= area.maxZ && (sameLevel(parsed.baseY, targetY) || sameLevel(parsed.y, targetY))) {
      delete ceilings[id]; changed = true
    }
  }

  for (const [id, stair] of Object.entries(next.stairs)) {
    if ((sameLevel(stair?.y, targetY) || sameLevel(stair?.topY, targetY)) && cellAreaIntersectsBounds(stair, area)) {
      delete stairs[id]; changed = true
    }
  }

  for (const [id, connector] of Object.entries(next.connectors)) {
    const sameStartOrEnd = sameLevel(connector?.y, targetY)
      || sameLevel(levelToY(connector?.fromLevel), targetY)
      || sameLevel(levelToY(connector?.toLevel), targetY)
    if (sameStartOrEnd && connectorIntersectsCellArea(connector, area)) { delete connectors[id]; changed = true }
  }

  return changed ? { ...next, rooms, floors, walls, ceilings, stairs, connectors } : surfaceData
}
