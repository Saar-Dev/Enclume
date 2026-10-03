// surfaceRooms.js — Gestion des pièces (création, modification, suppression, recherche)
// Extrait de surfaceData.js, Lot 6a du PLAN_REFACTOR_SURFACE.md

import { hashString, sameLevel } from './surfaceUtils.js'
import { DEFAULT_SURFACE_MATERIAL_PRESET } from './proceduralMaterials.js'
import { surfaceBlockingForTool, materialOrTextureForTool, toolForMaterialFace, makeSurfaceMaterial } from './materialDecision.js'
import { getToolWallThicknessFine } from './surfaceGeometry.js'
import {
  buildMergedRoomVerticalProfile,
  makeRoomBoundaryArc,
  multiPolygonContainsPoint,
  roomBoundaryEdges,
  roomBoundaryWallRuns,
  roomGeometryArea,
  roomGeometryContainsPoint,
  roomGeometryIntersectionArea,
  roomHasEffectiveBoundaryEdge,
  roomSliceAtLevel,
  selectedRoomBoundaryChain,
  normalizeWallElevationProfile,
} from '../../../shared/world/roomGeometry.js'
import {
  STORY_HEIGHT,
  levelToY,
  yToLevel,
  getRoomBaseY,
  getRoomHeightLevels,
  SURFACE_FINE,
  getToolLevel,
  getToolRoomHeightLevels,
  getToolFloorThickness,
  getToolCeilingThickness,
  getToolMovementMultiplier,
  getRoomFloorThickness,
  getRoomCeilingThickness,
  normalizeSurfaceData,
  normalizeCellSelection,
  roomCellKey,
  getRoomFootprintCells,
  DEFAULT_SURFACE_DATA,
} from './surfaceCore.js'

const DEFAULT_FLOOR_THICKNESS = 0.25
const STAIR_STEPS_PER_CELL = 4 // utilisé par makeRoomFromSelection pour le seed visuel uniquement

function profileOrDefault(profile, patch = {}) {
  return {
    ...DEFAULT_SURFACE_MATERIAL_PRESET,
    ...(profile || {}),
    ...patch,
  }
}

// ===================================================================
// Helpers internes
// ===================================================================

function roomKey(area, baseLevel, heightLevels) {
  return `room:${area.minX}:${area.minZ}:${area.maxX}:${area.maxZ}:${baseLevel}:${heightLevels}`
}

function rawRoomBounds(room) {
  const minX = Math.trunc(Number(room?.minX) || 0)
  const maxX = Math.trunc(Number(room?.maxX ?? minX) || minX)
  const minZ = Math.trunc(Number(room?.minZ) || 0)
  const maxZ = Math.trunc(Number(room?.maxZ ?? minZ) || minZ)
  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minZ: Math.min(minZ, maxZ),
    maxZ: Math.max(minZ, maxZ),
  }
}

function sortRoomCells(cells) {
  return [...cells].sort((left, right) => left.z - right.z || left.x - right.x)
}

function roomHasGeometryConstraint(room) {
  return (Array.isArray(room?.boundaryArcs) && room.boundaryArcs.length > 0)
    || (Array.isArray(room?.geometryClipRoomIds) && room.geometryClipRoomIds.length > 0)
}

function roomsShareVerticalVolume(left, right) {
  const leftBase = yToLevel(getRoomBaseY(left))
  const leftTop = leftBase + getRoomHeightLevels(left) - 1
  const rightBase = yToLevel(getRoomBaseY(right))
  const rightTop = rightBase + getRoomHeightLevels(right) - 1
  return leftTop >= rightBase && rightTop >= leftBase
}

function addGeometryClip(rooms, targetRoomId, clipRoomId) {
  if (!targetRoomId || !clipRoomId || targetRoomId === clipRoomId) return rooms
  const target = rooms[targetRoomId]
  if (!target || !rooms[clipRoomId]) return rooms
  const current = new Set(target.geometryClipRoomIds || [])
  if (current.has(clipRoomId)) return rooms
  current.add(clipRoomId)
  return { ...rooms, [targetRoomId]: { ...target, geometryClipRoomIds: [...current] } }
}

function connectedRoomFootprints(cells) {
  const byKey = new Map(cells.map(cell => [roomCellKey(cell.x, cell.z), cell]))
  const unvisited = new Set(byKey.keys())
  const components = []
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]]

  while (unvisited.size > 0) {
    const firstKey = [...unvisited].sort()[0]
    const first = byKey.get(firstKey)
    const queue = [first]
    const component = []
    unvisited.delete(firstKey)

    while (queue.length > 0) {
      const cell = queue.shift()
      component.push(cell)
      for (const [dx, dz] of neighbors) {
        const key = roomCellKey(cell.x + dx, cell.z + dz)
        if (!unvisited.has(key)) continue
        unvisited.delete(key)
        queue.push(byKey.get(key))
      }
    }
    components.push(sortRoomCells(component))
  }

  return components.sort((left, right) => (
    right.length - left.length
    || roomCellKey(left[0].x, left[0].z).localeCompare(roomCellKey(right[0].x, right[0].z))
  ))
}

function roomWithFootprint(room, id, cells, keepWorldId) {
  const bounds = {
    minX: Math.min(...cells.map(cell => cell.x)),
    maxX: Math.max(...cells.map(cell => cell.x)),
    minZ: Math.min(...cells.map(cell => cell.z)),
    maxZ: Math.max(...cells.map(cell => cell.z)),
  }
  const next = {
    ...room,
    ...bounds,
    id,
    shape: 'footprint',
    cells: cells.map(cell => roomCellKey(cell.x, cell.z)),
  }
  if (Array.isArray(next.boundaryArcs)) {
    const edgeKeys = new Set(roomBoundaryEdges(next).map(edge => edge.key))
    next.boundaryArcs = next.boundaryArcs.filter(arc => (
      Array.isArray(arc?.edgeKeys)
      && arc.edgeKeys.length >= 2
      && arc.edgeKeys.every(key => edgeKeys.has(key))
      && !selectedRoomBoundaryChain(next, arc.edgeKeys).error
    ))
  }
  if (Array.isArray(next.openWallEdgeKeys)) {
    const edgeKeys = new Set(roomBoundaryEdges(next).map(edge => edge.key))
    next.openWallEdgeKeys = [...new Set(next.openWallEdgeKeys)].filter(key => edgeKeys.has(key))
  }
  if (Array.isArray(next.geometryClipRoomIds)) {
    next.geometryClipRoomIds = [...new Set(next.geometryClipRoomIds)].filter(roomId => roomId !== id)
  }
  if (!keepWorldId) delete next.worldId
  return next
}

function roomIdsForBoundaryEdge(rooms, edgeKey, baseY) {
  return Object.entries(rooms || {})
    .filter(([, room]) => (
      sameLevel(getRoomBaseY(room), baseY)
      && roomHasEffectiveBoundaryEdge(room, edgeKey, rooms)
    ))
    .map(([id]) => id)
    .sort()
}

function clipIntersectingRoomsAgainstOwners(inputRooms, ownerRoomIds) {
  let rooms = inputRooms
  const owners = new Set(ownerRoomIds || [])
  for (const ownerId of owners) {
    const owner = rooms[ownerId]
    if (!owner) continue
    for (const [targetId, target] of Object.entries(rooms)) {
      if (owners.has(targetId) || targetId === ownerId) continue
      if (!roomsShareVerticalVolume(owner, target)) continue
      if ((owner.geometryClipRoomIds || []).includes(targetId)) continue
      if ((target.geometryClipRoomIds || []).includes(ownerId)) continue
      if (roomGeometryIntersectionArea(
        { id: ownerId, ...owner },
        { id: targetId, ...target },
        rooms,
      ) <= 1e-6) continue
      rooms = addGeometryClip(rooms, targetId, ownerId)
    }
  }
  return rooms
}

function doorConnectorTouchesBoundaryEdges(connector, room, selectedEdges) {
  if (connector?.type !== 'door') return false
  const doorY = Number(connector.y)
  const roomBaseY = getRoomBaseY(room)
  const roomTopY = roomBaseY + getRoomHeightLevels(room) * STORY_HEIGHT
  if (!Number.isFinite(doorY) || doorY < roomBaseY || doorY >= roomTopY) return false

  const axis = connector.axis
  if (axis === 'segment') {
    const selectedKeys = new Set(selectedEdges.map(edge => edge.key))
    return (room.boundaryArcs || []).some(arc => (
      (!connector.curveArcId || connector.curveArcId === arc.id)
      && (arc.edgeKeys || []).some(key => selectedKeys.has(key))
    ))
  }
  if (axis !== 'x' && axis !== 'z') return false
  const line = (axis === 'x' ? Number(connector.z0) : Number(connector.x0)) / SURFACE_FINE
  const alongStart = (axis === 'x' ? Number(connector.x0) : Number(connector.z0)) / SURFACE_FINE
  const alongEnd = (axis === 'x' ? Number(connector.x1) : Number(connector.z1)) / SURFACE_FINE
  if (![line, alongStart, alongEnd].every(Number.isFinite)) return false
  const alongCenter = (alongStart + alongEnd) / 2
  const epsilon = 1e-4

  return selectedEdges.some(edge => {
    if (edge.axis !== axis) return false
    const edgeLine = axis === 'x' ? edge.from.z : edge.from.x
    if (Math.abs(edgeLine - line) > epsilon) return false
    const edgeStart = axis === 'x' ? edge.from.x : edge.from.z
    const edgeEnd = axis === 'x' ? edge.to.x : edge.to.z
    return alongCenter >= Math.min(edgeStart, edgeEnd) - epsilon
      && alongCenter <= Math.max(edgeStart, edgeEnd) + epsilon
  })
}

function sameRoomFloor(left, right) {
  return sameLevel(getRoomBaseY(left), getRoomBaseY(right))
}

function uniqueObjectsById(items) {
  return [...new Map(items.filter(Boolean).map(item => [item.id, item])).values()]
}

function validateWholeWallSelection(room, edgeKeys) {
  const selected = new Set((edgeKeys || []).map(String))
  const runs = roomBoundaryWallRuns(room)
  const touched = runs.filter(run => run.edgeKeys.some(key => selected.has(key)))
  if (touched.length === 0) return { error: 'Sélectionne au moins un mur.' }
  if (touched.some(run => !run.edgeKeys.every(key => selected.has(key)))) {
    return { error: 'Sélectionne les murs entiers entre deux angles.' }
  }
  const validKeys = new Set(touched.flatMap(run => run.edgeKeys))
  if ([...selected].some(key => !validKeys.has(key))) {
    return { error: 'La sélection contient un segment qui n’appartient pas au contour.' }
  }
  return { selected, runs: touched }
}

function surfaceFeatureReferencesRoom(feature, roomId) {
  const target = String(roomId)
  if (feature?.roomId != null && String(feature.roomId) === target) return true
  return Array.isArray(feature?.roomIds)
    && feature.roomIds.some(value => String(value) === target)
}

function connectorAnchorCell(connector) {
  if (Number.isFinite(Number(connector?.x)) && Number.isFinite(Number(connector?.z))) {
    return { x: Math.floor(Number(connector.x)), z: Math.floor(Number(connector.z)) }
  }
  if (Number.isFinite(Number(connector?.x0)) && Number.isFinite(Number(connector?.z0))) {
    return {
      x: Math.floor(((Number(connector.x0) + Number(connector.x1 ?? connector.x0)) / 2) / SURFACE_FINE),
      z: Math.floor(((Number(connector.z0) + Number(connector.z1 ?? connector.z0)) / 2) / SURFACE_FINE),
    }
  }
  return null
}

// ===================================================================
// API publique — Recherche spatiale
// ===================================================================

export function findRoomAtCell(data, cell, level = null) {
  if (!cell) return null
  const surface = normalizeSurfaceData(data)
  const targetLevel = Number.isFinite(Number(level)) ? Number(level) : null
  const matches = []

  for (const [id, room] of Object.entries(surface.rooms)) {
    const identifiedRoom = { id, ...room }
    if (!roomGeometryContainsPoint(
      identifiedRoom,
      { x: Number(cell.x) + 0.5, z: Number(cell.z) + 0.5 },
      surface.rooms,
    )) continue

    const roomLevel = yToLevel(getRoomBaseY(room))
    if (targetLevel !== null) {
      const slice = roomSliceAtLevel(identifiedRoom, targetLevel - roomLevel, surface.rooms, STORY_HEIGHT)
      if (!slice || !multiPolygonContainsPoint(slice.footprint, {
        x: Number(cell.x) + 0.5,
        z: Number(cell.z) + 0.5,
      })) continue
    }

    matches.push({
      id,
      room: identifiedRoom,
      area: roomGeometryArea(identifiedRoom, surface.rooms),
    })
  }

  matches.sort((a, b) => a.area - b.area)
  return matches[0] || null
}

export function findRoomsInSelection(data, selection, level = null) {
  const area = normalizeCellSelection(selection)
  if (!area) return []

  const surface = normalizeSurfaceData(data)
  const targetLevel = Number.isFinite(Number(level)) ? Number(level) : null
  const matches = []

  for (const [id, room] of Object.entries(surface.rooms)) {
    const footprint = getRoomFootprintCells(room)
    const contained = footprint.every(cell => (
      cell.x >= area.minX && cell.x <= area.maxX && cell.z >= area.minZ && cell.z <= area.maxZ
    ))
    if (!contained) continue

    const roomLevel = yToLevel(getRoomBaseY(room))
    if (targetLevel !== null && !roomSliceAtLevel(
      { id, ...room },
      targetLevel - roomLevel,
      surface.rooms,
      STORY_HEIGHT,
    )) continue

    matches.push({
      id,
      room: { id, ...room },
      area: footprint.length,
    })
  }

  matches.sort((a, b) => a.area - b.area)
  return matches
}

// Entités dont la position (pos_x/pos_y horizontal, pos_z hauteur — repère entité, distinct du
// repère salle x/z horizontal + y hauteur) résout, via la même autorité findRoomAtCell que le
// reste de l'éditeur (salle imbriquée = la plus petite gagne), vers `roomId`. Approximation à la
// case comme tous les appelants existants de findRoomAtCell (resolveSelectHit.js, connectors.js) —
// pas une nouvelle granularité inventée pour l'occasion.
export function getEntitiesInRoom(surfaceData, entities, roomId) {
  if (!roomId || !Array.isArray(entities) || entities.length === 0) return []
  const surface = normalizeSurfaceData(surfaceData)
  if (!surface.rooms?.[roomId]) return []
  return entities.filter(entity => {
    const cell = {
      x: Math.floor(Number(entity.pos_x) || 0),
      z: Math.floor(Number(entity.pos_y) || 0),
    }
    const level = yToLevel(Number(entity.pos_z) || 0)
    return findRoomAtCell(surface, cell, level)?.id === roomId
  })
}

export function getRoomBounds(room) {
  const cells = Array.isArray(room?.cells) && room.cells.length > 0
    ? getRoomFootprintCells(room)
    : []
  if (cells.length === 0) return rawRoomBounds(room)
  return {
    minX: Math.min(...cells.map(cell => cell.x)),
    maxX: Math.max(...cells.map(cell => cell.x)),
    minZ: Math.min(...cells.map(cell => cell.z)),
    maxZ: Math.max(...cells.map(cell => cell.z)),
  }
}

// ===================================================================
// API publique — Création et modification de pièce
// ===================================================================

export function makeRoomFromSelection(_surfaceData, selection, tool, activeMaterial, availableBlocks) {
  const area = normalizeCellSelection(selection)
  if (!area) return null

  const baseLevel = getToolLevel(tool)
  const heightLevels = getToolRoomHeightLevels(tool)
  const baseY = levelToY(baseLevel)
  const id = roomKey(area, baseLevel, heightLevels)
  const blocking = surfaceBlockingForTool(tool)
  const floorAppearance = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'floor'),
    packId: tool?.floorPackId,
    textureId: tool?.floorTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:floor`,
  })
  const ceilingAppearance = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'ceiling'),
    packId: tool?.ceilingPackId || tool?.floorPackId,
    textureId: tool?.ceilingTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:ceiling`,
  })
  const wallInterior = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'wallInterior'),
    packId: tool?.wallInteriorPackId,
    textureId: tool?.wallInteriorTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:wall:interior`,
  })

  return {
    id,
    type: 'room',
    shape: 'footprint',
    theme: tool?.roomTheme || 'custom',
    seed: hashString(`${id}:${tool?.materialProfiles?.floor?.seed || ''}`),
    minX: area.minX,
    maxX: area.maxX,
    minZ: area.minZ,
    maxZ: area.maxZ,
    cells: Array.from({ length: area.depth }, (_, dz) => (
      Array.from({ length: area.width }, (_, dx) => roomCellKey(area.minX + dx, area.minZ + dz))
    )).flat(),
    level: baseLevel,
    y: baseY,
    heightLevels,
    height: heightLevels * STORY_HEIGHT,
    floorEnabled: true,
    ceilingEnabled: true,
    wallEnabled: true,
    floorThickness: getToolFloorThickness(tool),
    ceilingThickness: getToolCeilingThickness(tool),
    wallThickness: getToolWallThicknessFine(tool),
    movementMultiplier: getToolMovementMultiplier(tool),
    ...blocking,
    floorTex: floorAppearance.tex,
    ceilingTex: ceilingAppearance.tex,
    wallInteriorTex: wallInterior.tex,
    floorMaterial: floorAppearance.material,
    ceilingMaterial: ceilingAppearance.material,
    wallInteriorMaterial: wallInterior.material,
  }
}

export function applyRoomSelection(surfaceData, selection, tool, activeMaterial, availableBlocks) {
  const room = makeRoomFromSelection(surfaceData, selection, tool, activeMaterial, availableBlocks)
  if (!room) return surfaceData

  const next = normalizeSurfaceData(surfaceData)
  if (next.rooms[room.id]) return surfaceData

  const rooms = { ...next.rooms }
  const replacementRooms = new Map()
  const claimedKeys = new Set(getRoomFootprintCells(room).map(cell => roomCellKey(cell.x, cell.z)))
  const roomBaseLevel = yToLevel(getRoomBaseY(room))
  const roomTopLevel = roomBaseLevel + getRoomHeightLevels(room) - 1

  for (const [existingId, existingRoom] of Object.entries(next.rooms)) {
    const existingBaseLevel = yToLevel(getRoomBaseY(existingRoom))
    const existingTopLevel = existingBaseLevel + getRoomHeightLevels(existingRoom) - 1
    if (existingTopLevel < roomBaseLevel || roomTopLevel < existingBaseLevel) continue

    if (roomHasGeometryConstraint(existingRoom)) continue

    const existingCells = getRoomFootprintCells(existingRoom)
    const remainingCells = existingCells.filter(cell => !claimedKeys.has(roomCellKey(cell.x, cell.z)))
    if (remainingCells.length === existingCells.length) continue

    delete rooms[existingId]
    const components = connectedRoomFootprints(remainingCells)
    const replacements = components.map((component, index) => {
      const id = index === 0
        ? existingId
        : `${existingId}:split:${Math.abs(hashString(component.map(cell => roomCellKey(cell.x, cell.z)).join('|')))}`
      rooms[id] = roomWithFootprint(existingRoom, id, component, index === 0)
      return {
        id,
        cells: new Set(component.map(cell => roomCellKey(cell.x, cell.z))),
      }
    })
    replacements.push({ id: room.id, cells: claimedKeys })
    replacementRooms.set(existingId, replacements)
  }

  const geometryClipRoomIds = []
  const lookupWithCandidate = { ...rooms, [room.id]: room }
  for (const [existingId, existingRoom] of Object.entries(rooms)) {
    if (!roomHasGeometryConstraint(existingRoom)) continue
    if (!roomsShareVerticalVolume(room, existingRoom)) continue
    if (roomGeometryIntersectionArea(
      { id: room.id, ...room },
      { id: existingId, ...existingRoom },
      lookupWithCandidate,
    ) > 1e-6) geometryClipRoomIds.push(existingId)
  }
  const createdRoom = geometryClipRoomIds.length > 0
    ? { ...room, geometryClipRoomIds }
    : room
  const finalRoomLookup = { ...rooms, [room.id]: createdRoom }
  if (roomGeometryArea({ id: room.id, ...createdRoom }, finalRoomLookup) <= 1e-6) return surfaceData
  rooms[room.id] = createdRoom
  const connectors = Object.fromEntries(Object.entries(next.connectors).map(([id, connector]) => {
    const anchor = connectorAnchorCell(connector)
    const replaceRoomId = currentId => {
      const candidates = replacementRooms.get(currentId)
      if (!candidates) return currentId
      if (anchor) {
        const candidate = candidates.find(item => item.cells.has(roomCellKey(anchor.x, anchor.z)))
        if (candidate) return candidate.id
      }
      return candidates[0]?.id || room.id
    }
    const roomIds = [...new Set((connector.roomIds || []).map(replaceRoomId))]
    return [id, {
      ...connector,
      ...(connector.roomId ? { roomId: replaceRoomId(connector.roomId) } : {}),
      ...(connector.roomIds ? { roomIds } : {}),
    }]
  }))

  return {
    ...next,
    rooms,
    connectors,
  }
}

export function applyRoomSelectionWithResult(surfaceData, selection, tool, activeMaterial, availableBlocks) {
  const candidate = makeRoomFromSelection(surfaceData, selection, tool, activeMaterial, availableBlocks)
  const nextSurfaceData = applyRoomSelection(surfaceData, selection, tool, activeMaterial, availableBlocks)
  const roomId = nextSurfaceData !== surfaceData && candidate && nextSurfaceData.rooms?.[candidate.id]
    ? candidate.id
    : null
  return { surfaceData: nextSurfaceData, roomId }
}

function roomWallInteriorTex(room) {
  return room?.wallInteriorTex || null
}

function roomWallInteriorMaterial(room) {
  return room?.wallInteriorMaterial || null
}

function roomMaterialProfilesForTool(tool) {
  const profiles = tool?.materialProfiles || {}
  return {
    floor: profiles.floor || tool?.materialPreset,
    ceiling: profiles.ceiling || tool?.materialPreset,
  }
}

// Synchronise en continu une salle déjà SÉLECTIONNÉE avec le panneau Salle (`SurfaceRoomPanel.jsx`,
// onglet Sol — seul `materialProfiles.floor`/`ceiling` y sont exposés). Ne touche PLUS jamais
// `wallInteriorTex`/`wallInteriorMaterial` : ce champ a deux autres autorités, exclusives et déjà
// suffisantes — `makeRoomFromSelection` à la création de la salle, et `applyRoomWallAppearance`/
// `paintRoomWallRoom` (panneau flottant Mur, outil Peindre) en édition. Avant ce correctif, cette
// fonction recalculait quand même un wallInterior à partir de `tool.materialProfiles.wallInterior`
// — un champ qu'AUCUNE interface actuelle n'écrit plus (`wallInteriorTexId` : mort depuis l'Option 2
// du §8, PLAN_WORLD_BUILDER_REWORK.md ; `materialProfiles.wallInterior` : jamais exposé par un onglet)
// — donc toujours retombait sur le même défaut figé. Comme cette fonction se redéclenche à chaque
// churn de `surfaceTool` tant qu'une salle reste sélectionnée (Editor3D.jsx), elle écrasait la
// vraie couleur des murs juste posée via le panneau flottant Mur l'instant suivant : deux autorités
// sur la même donnée (invariant AGENTS.md violé), pas un bug de timing. Reproduit par script Node
// (PLAN_WORLD_BUILDER_REWORK.md §19) avant correction, jamais deviné.
export function applyRoomToolUpdate(surfaceData, roomId, tool, activeMaterial, availableBlocks) {
  if (!roomId) return surfaceData
  const next = normalizeSurfaceData(surfaceData)
  const room = next.rooms?.[roomId]
  if (!room) return surfaceData

  const id = room.id || roomId
  const profiles = roomMaterialProfilesForTool(tool)
  const toolWithProfiles = {
    ...tool,
    materialProfiles: {
      ...(tool?.materialProfiles || {}),
      ...profiles,
    },
  }
  const floorAppearance = materialOrTextureForTool({
    tool: toolForMaterialFace(toolWithProfiles, 'floor'),
    packId: tool?.floorPackId,
    textureId: tool?.floorTexId || room.floorTex,
    fallbackTexId: room.floorTex || activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:floor`,
  })
  const ceilingAppearance = materialOrTextureForTool({
    tool: toolForMaterialFace(toolWithProfiles, 'ceiling'),
    packId: tool?.ceilingPackId || tool?.floorPackId,
    textureId: tool?.ceilingTexId || room.ceilingTex,
    fallbackTexId: room.ceilingTex || activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:ceiling`,
  })

  const heightLevels = getToolRoomHeightLevels(tool)
  const blocking = surfaceBlockingForTool(tool)
  const updated = {
    ...room,
    label: String(tool?.roomName || room.label || room.name || id).trim() || id,
    heightLevels,
    height: heightLevels * STORY_HEIGHT,
    floorThickness: getToolFloorThickness(tool),
    ceilingThickness: getToolCeilingThickness(tool),
    wallThickness: getToolWallThicknessFine(tool),
    movementMultiplier: getToolMovementMultiplier(tool),
    ...blocking,
    floorTex: floorAppearance.tex,
    ceilingTex: ceilingAppearance.tex,
    floorMaterial: floorAppearance.material,
    ceilingMaterial: ceilingAppearance.material,
  }

  if (JSON.stringify(updated) === JSON.stringify(room)) return surfaceData

  return {
    ...next,
    rooms: {
      ...next.rooms,
      [roomId]: updated,
    },
  }
}

// ===================================================================
// API publique — Suppression de pièce et murs
// ===================================================================

export function deleteSurfaceRoom(surfaceData, roomId) {
  const next = normalizeSurfaceData(surfaceData)
  const target = String(roomId || '')
  if (!target || !next.rooms?.[target]) return surfaceData

  const rooms = Object.fromEntries(Object.entries(next.rooms).flatMap(([id, room]) => {
    if (id === target) return []
    const geometryClipRoomIds = Array.isArray(room.geometryClipRoomIds)
      ? room.geometryClipRoomIds.filter(value => String(value) !== target)
      : null
    const boundaryArcs = Array.isArray(room.boundaryArcs)
      ? room.boundaryArcs.map(arc => (
          String(arc?.ownerRoomId || '') === target
            ? { ...arc, ownerRoomId: id }
            : arc
        ))
      : null
    const clipsChanged = geometryClipRoomIds
      && geometryClipRoomIds.length !== room.geometryClipRoomIds.length
    const arcsChanged = boundaryArcs
      && boundaryArcs.some((arc, index) => arc !== room.boundaryArcs[index])
    return [[id, clipsChanged || arcsChanged ? {
      ...room,
      ...(geometryClipRoomIds ? { geometryClipRoomIds } : {}),
      ...(boundaryArcs ? { boundaryArcs } : {}),
    } : room]]
  }))
  const connectors = Object.fromEntries(Object.entries(next.connectors || {})
    .filter(([, connector]) => !surfaceFeatureReferencesRoom(connector, target)))

  return { ...next, rooms, connectors }
}

export function deleteRoomBoundaryWalls(surfaceData, roomId, edgeKeys) {
  const next = normalizeSurfaceData(surfaceData)
  const selectedRoom = next.rooms?.[roomId]
  if (!selectedRoom) return { surfaceData, error: 'La salle sélectionnée n’existe plus.' }
  const validation = validateWholeWallSelection(selectedRoom, edgeKeys)
  if (validation.error) return { surfaceData, error: validation.error }

  const selectedKeys = [...validation.selected]
  const selectedEdges = roomBoundaryEdges(selectedRoom).filter(edge => validation.selected.has(edge.key))
  const ownerships = selectedKeys.map(key => roomIdsForBoundaryEdge(
    next.rooms,
    key,
    getRoomBaseY(selectedRoom),
  ))
  const signature = ownerships[0]?.join('|') || ''
  if (!signature || ownerships.some(ids => ids.join('|') !== signature)) {
    return { surfaceData, error: 'Les murs supprimés doivent border le même extérieur ou la même salle voisine.' }
  }
  const ownerIds = ownerships[0]
  if (!ownerIds.includes(roomId)) return { surfaceData, error: 'La sélection ne fait pas partie de cette salle.' }
  if (ownerIds.length > 2) return { surfaceData, error: 'Cette frontière appartient à trop de salles pour être supprimée.' }

  const removedDoorIds = new Set(Object.entries(next.connectors || {})
    .filter(([, connector]) => doorConnectorTouchesBoundaryEdges(connector, selectedRoom, selectedEdges))
    .map(([id]) => id))

  if (ownerIds.length === 1) {
    const openWallEdgeKeys = [...new Set([
      ...(selectedRoom.openWallEdgeKeys || []),
      ...selectedKeys,
    ])]
    const connectors = Object.fromEntries(Object.entries(next.connectors || {})
      .filter(([id]) => !removedDoorIds.has(id)))
    return {
      surfaceData: {
        ...next,
        rooms: {
          ...next.rooms,
          [roomId]: { ...selectedRoom, openWallEdgeKeys },
        },
        connectors,
      },
      error: null,
      roomId,
      mergedRoomIds: [],
    }
  }

  const absorbedId = ownerIds.find(id => id !== roomId)
  const absorbedRoom = next.rooms[absorbedId]
  if (!absorbedRoom || !sameRoomFloor(selectedRoom, absorbedRoom)) {
    return { surfaceData, error: 'Deux salles doivent avoir le même niveau de sol pour être fusionnées.' }
  }

  const mergedCells = sortRoomCells(new Map([
    ...getRoomFootprintCells(selectedRoom),
    ...getRoomFootprintCells(absorbedRoom),
  ].map(cell => [roomCellKey(cell.x, cell.z), cell])).values())
  const boundaryArcs = uniqueObjectsById([
    ...(selectedRoom.boundaryArcs || []),
    ...(absorbedRoom.boundaryArcs || []),
  ])
    .filter(arc => !(arc.edgeKeys || []).some(key => validation.selected.has(key)))
    .map(arc => ({ ...arc, ownerRoomId: roomId }))
  const openWallEdgeKeys = [...new Set([
    ...(selectedRoom.openWallEdgeKeys || []),
    ...(absorbedRoom.openWallEdgeKeys || []),
  ])]
  const geometryClipRoomIds = [...new Set([
    ...(selectedRoom.geometryClipRoomIds || []),
    ...(absorbedRoom.geometryClipRoomIds || []),
  ])].filter(id => !ownerIds.includes(id))
  const wallElevationProfiles = uniqueObjectsById([
    ...(selectedRoom.wallElevationProfiles || []),
    ...(absorbedRoom.wallElevationProfiles || []),
  ]).flatMap(entry => {
    const retainedKeys = (entry?.edgeKeys || []).map(String).filter(key => !validation.selected.has(key))
    return retainedKeys.length > 0 ? [{ ...entry, edgeKeys: retainedKeys }] : []
  })
  const wallAppearanceProfiles = uniqueObjectsById([
    ...(selectedRoom.wallAppearanceProfiles || []),
    ...(absorbedRoom.wallAppearanceProfiles || []),
  ]).flatMap(entry => {
    const retainedKeys = (entry?.edgeKeys || []).map(String).filter(key => !validation.selected.has(key))
    return retainedKeys.length > 0 ? [{ ...entry, edgeKeys: retainedKeys }] : []
  })
  const maximumHeightLevels = Math.max(getRoomHeightLevels(selectedRoom), getRoomHeightLevels(absorbedRoom))
  const mergedGeometryRoom = roomWithFootprint({
    ...selectedRoom,
    verticalProfile: null,
    heightLevels: maximumHeightLevels,
    height: maximumHeightLevels * STORY_HEIGHT,
    boundaryArcs,
    openWallEdgeKeys,
    geometryClipRoomIds,
    wallElevationProfiles,
    wallAppearanceProfiles,
  }, roomId, mergedCells, true)
  const verticalProfile = buildMergedRoomVerticalProfile({
    mergedRoom: { id: roomId, ...mergedGeometryRoom },
    sourceRooms: [
      { id: roomId, ...selectedRoom },
      { id: absorbedId, ...absorbedRoom },
    ],
    roomLookup: next.rooms,
    storyHeight: STORY_HEIGHT,
  })
  const canonicalHeightLevels = verticalProfile
    ? verticalProfile.slices.length
    : maximumHeightLevels
  const mergedRoom = {
    ...mergedGeometryRoom,
    heightLevels: canonicalHeightLevels,
    height: canonicalHeightLevels * STORY_HEIGHT,
    ...(verticalProfile ? { verticalProfile } : {}),
  }

  let rooms = Object.fromEntries(Object.entries(next.rooms)
    .filter(([id]) => id !== absorbedId)
    .map(([id, room]) => {
      if (id === roomId) return [id, mergedRoom]
      const clips = [...new Set((room.geometryClipRoomIds || [])
        .map(clipId => clipId === absorbedId ? roomId : clipId))]
        .filter(clipId => clipId !== id)
      return [id, clips.length > 0 || room.geometryClipRoomIds ? { ...room, geometryClipRoomIds: clips } : room]
    }))
  rooms = clipIntersectingRoomsAgainstOwners(rooms, [roomId])

  const connectors = Object.fromEntries(Object.entries(next.connectors || {})
    .filter(([id]) => !removedDoorIds.has(id))
    .map(([id, connector]) => {
      const replace = value => value === absorbedId ? roomId : value
      const roomIds = connector.roomIds
        ? [...new Set(connector.roomIds.map(replace))]
        : null
      return [id, {
        ...connector,
        ...(connector.roomId ? { roomId: replace(connector.roomId) } : {}),
        ...(roomIds ? { roomIds } : {}),
      }]
    }))

  return {
    surfaceData: { ...next, rooms, connectors },
    error: null,
    roomId,
    mergedRoomIds: [absorbedId],
  }
}

// ===================================================================
// API publique — geste de forme (peindre/effacer des cases), agrandir/rétrécir une salle
// ===================================================================
//
// Choix d'architecture (2026-09-28, remplace une première version « poignée sur mur ») : la case
// est la seule donnée à identité stable de ce module (`room.cells`) ; le mur n'en a aucune, il est
// redérivé des cases à chaque compilation (`roomsWallSegments`). Faire porter le geste sur le mur
// obligeait à retraduire une case en abstraction de mur puis en sens/magnitude implicites — source
// du bug d'échelle qui a cassé la première version. Peindre/effacer directement des cases (comme
// Dungeondraft ou RimWorld : la salle est un ensemble de cases, le mur n'est qu'un rendu du bord)
// élimine cette traduction et réutilise le même repère que `getFloorCell`, déjà utilisé par le
// glisser-déposer générique.

function prunedByRetainedEdges(entries, edgeKeySet) {
  return (entries || []).flatMap(entry => {
    const retainedKeys = (entry?.edgeKeys || []).map(String).filter(key => edgeKeySet.has(key))
    return retainedKeys.length > 0 ? [{ ...entry, edgeKeys: retainedKeys }] : []
  })
}

function dedupeRoomCells(cells) {
  const seen = new Set()
  const result = []
  for (const cell of cells || []) {
    const x = Math.trunc(Number(cell?.x))
    const z = Math.trunc(Number(cell?.z))
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue
    const key = roomCellKey(x, z)
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ x, z })
  }
  return result
}

// Arêtes de bord (une par côté extérieur) qui appartiennent précisément à la case (x,z) — dérivées
// des mêmes coordonnées que `makeEdge` dans roomGeometry.js (le coin de départ de chaque côté),
// jamais une clé persistée.
function boundaryEdgesTouchingCell(boundaryEdges, x, z) {
  return boundaryEdges.filter(edge => {
    if (edge.side === 'north') return edge.from.x === x && edge.from.z === z
    if (edge.side === 'east') return edge.from.x === x + 1 && edge.from.z === z
    if (edge.side === 'south') return edge.from.x === x + 1 && edge.from.z === z + 1
    if (edge.side === 'west') return edge.from.x === x && edge.from.z === z + 1
    return false
  })
}

// Classe chaque case candidate (acceptée ou refusée, avec la raison) sans muter les données —
// utilisé à la fois pour l'aperçu pendant le geste (case par case, en direct) et pour l'application
// finale : même calcul, un seul appel, jamais deux logiques divergentes.
// `mode` vaut 'add' (peindre — étend la salle) ou 'remove' (effacer — la rétrécit).
// `batchError` porte un refus global (salle vidée, salle coupée en deux) — les mêmes invariants
// que l'ancienne extendRoomWallRun, jamais assouplis, juste réévalués sur l'empreinte finale
// plutôt que sur un tronçon de mur.
export function classifyRoomFootprintCells(surfaceData, roomId, cells, mode) {
  const next = normalizeSurfaceData(surfaceData)
  const room = next.rooms?.[roomId]
  const candidates = dedupeRoomCells(cells)
  if (!room) {
    return { cells: candidates.map(cell => ({ ...cell, accepted: false, reason: 'room-missing' })), batchError: null }
  }

  const currentCells = getRoomFootprintCells(room)
  const currentKeySet = new Set(currentCells.map(cell => roomCellKey(cell.x, cell.z)))

  if (mode === 'remove') {
    const boundaryEdges = roomBoundaryEdges(room)
    const doors = Object.values(next.connectors || {})
    const classified = candidates.map(cell => {
      const key = roomCellKey(cell.x, cell.z)
      if (!currentKeySet.has(key)) return { ...cell, accepted: false, reason: 'not-in-room' }
      // Une case intérieure n'a aucune arête de bord actuelle (cellEdges vide) : rien à vérifier
      // côté porte, elle est retirable comme n'importe quelle autre — un pilier au milieu d'une
      // salle est une forme valide (roomBoundaryLoops classe toute boucle interne comme un trou,
      // déjà utilisé ailleurs pour les découpes de salles ; vérifié en lisant l'algorithme, pas
      // supposé).
      const cellEdges = boundaryEdgesTouchingCell(boundaryEdges, cell.x, cell.z)
      const doorOnCell = doors.some(connector => doorConnectorTouchesBoundaryEdges(connector, room, cellEdges))
      if (doorOnCell) return { ...cell, accepted: false, reason: 'door' }
      return { ...cell, accepted: true, reason: null }
    })
    const removedKeys = new Set(classified.filter(cell => cell.accepted).map(cell => roomCellKey(cell.x, cell.z)))
    if (removedKeys.size === 0) return { cells: classified, batchError: null }
    const finalCells = currentCells.filter(cell => !removedKeys.has(roomCellKey(cell.x, cell.z)))
    if (finalCells.length === 0) {
      return { cells: classified, batchError: 'Une salle ne peut pas rester sans aucune case.' }
    }
    if (connectedRoomFootprints(finalCells).length > 1) {
      return { cells: classified, batchError: 'Ce retrait couperait la salle en deux morceaux séparés.' }
    }
    return { cells: classified, batchError: null }
  }

  // mode === 'add'
  const occupiedElsewhere = new Set(
    Object.entries(next.rooms)
      .filter(([id, other]) => id !== roomId && sameRoomFloor(room, other))
      .flatMap(([, other]) => getRoomFootprintCells(other).map(cell => roomCellKey(cell.x, cell.z))),
  )
  const provisional = candidates.map(cell => {
    const key = roomCellKey(cell.x, cell.z)
    if (currentKeySet.has(key)) return { ...cell, accepted: false, reason: 'already-in-room' }
    if (occupiedElsewhere.has(key)) return { ...cell, accepted: false, reason: 'occupied' }
    return { ...cell, accepted: true, reason: null }
  })
  const acceptedSoFar = provisional.filter(cell => cell.accepted)
  if (acceptedSoFar.length === 0) return { cells: provisional, batchError: null }

  // Une case ajoutée doit rejoindre la salle — seule ou via d'autres cases acceptées dans le même
  // geste. Si en excluant les cases occupées le reste se scinde, on ne garde que le morceau
  // toujours relié à la salle d'origine (jamais un îlot flottant créé en silence).
  const finalCells = [...currentCells, ...acceptedSoFar]
  const components = connectedRoomFootprints(finalCells)
  const mainComponent = components.find(component => (
    component.some(cell => currentKeySet.has(roomCellKey(cell.x, cell.z)))
  )) || components[0] || []
  const mainComponentKeys = new Set(mainComponent.map(cell => roomCellKey(cell.x, cell.z)))
  const classified = provisional.map(cell => (
    cell.accepted && !mainComponentKeys.has(roomCellKey(cell.x, cell.z))
      ? { ...cell, accepted: false, reason: 'disconnected' }
      : cell
  ))
  return { cells: classified, batchError: null }
}

// Applique le résultat de classifyRoomFootprintCells : n'écrit que les cases acceptées, en une
// seule mise à jour d'empreinte (jamais case par case — la purge des arcs/profils de mur doit voir
// l'état final, pas un état intermédiaire).
export function paintRoomFootprintCells(surfaceData, roomId, cells, mode) {
  const next = normalizeSurfaceData(surfaceData)
  const room = next.rooms?.[roomId]
  if (!room) return { surfaceData, error: 'La salle sélectionnée n’existe plus.', cells: [] }

  const classification = classifyRoomFootprintCells(next, roomId, cells, mode)
  if (classification.batchError) {
    return { surfaceData, error: classification.batchError, cells: classification.cells }
  }

  const acceptedCells = classification.cells.filter(cell => cell.accepted)
  if (acceptedCells.length === 0) return { surfaceData, error: null, roomId, cells: classification.cells }

  const currentCells = getRoomFootprintCells(room)
  const acceptedKeys = new Set(acceptedCells.map(cell => roomCellKey(cell.x, cell.z)))
  const finalCells = mode === 'remove'
    ? currentCells.filter(cell => !acceptedKeys.has(roomCellKey(cell.x, cell.z)))
    : [...currentCells, ...acceptedCells]

  const nextRoom = roomWithFootprint(room, roomId, finalCells, true)
  const nextEdgeKeySet = new Set(roomBoundaryEdges(nextRoom).map(edge => edge.key))
  const prunedRoom = {
    ...nextRoom,
    wallElevationProfiles: prunedByRetainedEdges(nextRoom.wallElevationProfiles, nextEdgeKeySet),
    wallAppearanceProfiles: prunedByRetainedEdges(nextRoom.wallAppearanceProfiles, nextEdgeKeySet),
  }

  return {
    surfaceData: { ...next, rooms: { ...next.rooms, [roomId]: prunedRoom } },
    error: null,
    roomId,
    cells: classification.cells,
  }
}

// ===================================================================
// API publique — Arcs et profils de mur
// ===================================================================

export function applyRoomBoundaryArc(surfaceData, roomId, edgeKeys, angleDegrees = 90, sideMultiplier = 1) {
  const next = normalizeSurfaceData(surfaceData)
  const room = next.rooms?.[roomId]
  if (!room) return { surfaceData, error: 'La salle sélectionnée n’existe plus.' }
  const selectedKeys = [...new Set((edgeKeys || []).map(String))]
  const built = makeRoomBoundaryArc({ id: roomId, ...room }, selectedKeys, angleDegrees, sideMultiplier)
  if (built.error) return { surfaceData, error: built.error }

  const selectedKeySet = new Set(selectedKeys)
  const selectedEdges = roomBoundaryEdges(room).filter(edge => selectedKeySet.has(edge.key))
  const doorOnSelection = Object.values(next.connectors || {})
    .some(connector => doorConnectorTouchesBoundaryEdges(connector, room, selectedEdges))
  if (doorOnSelection) {
    return { surfaceData, error: 'Déplace ou supprime d’abord la porte placée sur ces murs.' }
  }

  const ownerships = selectedKeys.map(key => roomIdsForBoundaryEdge(next.rooms, key, getRoomBaseY(room)))
  const signature = ownerships[0]?.join('|') || ''
  if (!signature || ownerships.some(ids => ids.join('|') !== signature)) {
    return { surfaceData, error: 'Tous les murs doivent séparer la même salle voisine, ou le même extérieur.' }
  }
  const targetRoomIds = ownerships[0]
  if (!targetRoomIds.includes(roomId)) return { surfaceData, error: 'La sélection ne fait pas partie de cette salle.' }
  for (const targetRoomId of targetRoomIds) {
    const targetRoom = next.rooms[targetRoomId]
    if (selectedRoomBoundaryChain(targetRoom, selectedKeys).error) {
      return { surfaceData, error: 'Le contour partagé ne permet pas un arrondi continu.' }
    }
  }

  const arc = { ...built.arc, ownerRoomId: roomId }
  let rooms = { ...next.rooms }
  for (const targetRoomId of targetRoomIds) {
    const targetRoom = rooms[targetRoomId]
    const boundaryArcs = (Array.isArray(targetRoom.boundaryArcs) ? targetRoom.boundaryArcs : [])
      .filter(existing => !(existing?.edgeKeys || []).some(key => selectedKeySet.has(key)))
    rooms[targetRoomId] = { ...targetRoom, boundaryArcs: [...boundaryArcs, arc] }
  }
  rooms = clipIntersectingRoomsAgainstOwners(rooms, targetRoomIds)
  return {
    surfaceData: { ...next, rooms },
    error: null,
    roomIds: targetRoomIds,
    arc,
  }
}

export function removeRoomBoundaryArcs(surfaceData, roomId, edgeKeys) {
  const next = normalizeSurfaceData(surfaceData)
  const selectedRoom = next.rooms?.[roomId]
  if (!selectedRoom) return surfaceData
  const selected = new Set((edgeKeys || []).map(String))
  if (selected.size === 0) return surfaceData
  const targetRoomIds = new Set([...selected].flatMap(key => (
    roomIdsForBoundaryEdge(next.rooms, key, getRoomBaseY(selectedRoom))
  )))
  let changed = false
  const rooms = Object.fromEntries(Object.entries(next.rooms).map(([id, room]) => {
    if (!targetRoomIds.has(id)) return [id, room]
    const current = Array.isArray(room.boundaryArcs) ? room.boundaryArcs : []
    const boundaryArcs = current.filter(arc => !(arc?.edgeKeys || []).some(key => selected.has(key)))
    if (boundaryArcs.length === current.length) return [id, room]
    changed = true
    return [id, { ...room, boundaryArcs }]
  }))
  return changed ? { ...next, rooms } : surfaceData
}

export function applyRoomWallElevationProfile(surfaceData, roomId, edgeKeys, profile) {
  const next = normalizeSurfaceData(surfaceData)
  const selectedRoom = next.rooms?.[roomId]
  if (!selectedRoom) return { surfaceData, error: 'La salle sélectionnée n’existe plus.' }
  const selected = [...new Set((edgeKeys || []).map(String))]
  if (selected.length === 0) return { surfaceData, error: 'Sélectionne au moins un mur.' }

  const normalized = normalizeWallElevationProfile(profile)
  const selectedSet = new Set(selected)
  if (normalized.type !== 'vertical') {
    const selectedEdges = roomBoundaryEdges(selectedRoom).filter(edge => selectedSet.has(edge.key))
    const doorOnSelection = Object.values(next.connectors || {})
      .some(connector => doorConnectorTouchesBoundaryEdges(connector, selectedRoom, selectedEdges))
    if (doorOnSelection) {
      return { surfaceData, error: 'Déplace ou supprime la porte avant de modifier le profil vertical de ce mur.' }
    }
  }
  const profileId = `wall-elevation:${selected.slice().sort().join('|')}`

  const rooms = Object.fromEntries(Object.entries(next.rooms).map(([id, room]) => {
    if (id !== roomId) return [id, room]
    const remaining = (room.wallElevationProfiles || []).flatMap(entry => {
      const retainedKeys = (entry?.edgeKeys || []).map(String).filter(key => !selectedSet.has(key))
      return retainedKeys.length > 0 ? [{ ...entry, edgeKeys: retainedKeys }] : []
    })
    const wallElevationProfiles = normalized.type === 'vertical' || normalized.depth <= 0
      ? remaining
      : [...remaining, { id: profileId, edgeKeys: selected, profile: normalized }]
    return [id, { ...room, wallElevationProfiles }]
  }))

  return {
    surfaceData: { ...next, rooms },
    error: null,
    roomId,
    profile: normalized,
  }
}

export function applyRoomWallAppearance(surfaceData, roomId, edgeKeys, appearance) {
  const next = normalizeSurfaceData(surfaceData)
  const selectedRoom = next.rooms?.[roomId]
  if (!selectedRoom) return { surfaceData, error: 'La salle sélectionnée n’existe plus.' }
  const selected = [...new Set((edgeKeys || []).map(String))]
  if (selected.length === 0) return { surfaceData, error: 'Sélectionne au moins un mur.' }

  const selectedSet = new Set(selected)

  // Aucun garde-fou porte ici (§21, PLAN_WORLD_BUILDER_REWORK.md, 2026-09-30) — corrigé après l'avoir
  // ajouté par erreur le 2026-09-29 (commentaire ci-dessous conservé pour la trace). Contrairement à
  // `applyRoomWallElevationProfile`/`applyRoomBoundaryArc`, qui déplacent/courbent le mur et peuvent
  // désaligner une porte montée dessus, peindre ne touche QUE `wallAppearanceProfiles`/
  // `interiorMaterial` — aucune géométrie, aucune position. `.claude/rules/world.md` : « une apparence
  // 3D n'implique jamais une collision » — bloquer ici n'avait donc aucune raison physique, seulement
  // une cohérence de façade avec les deux autres opérations copiée sans revérifier si elle s'appliquait.
  // Trouvé en production (Saar, 2026-09-30) : toute salle avec au moins une porte refusait TOUT
  // changement d'apparence sur `wallAppearanceProfiles` couvrant ses murs (ex. « tout sélectionner »
  // dans le panneau flottant Mur), silencieusement — l'erreur existait (`roomArcError`) mais n'était pas
  // le signal qu'un correctif « ne marche pas » aurait suggéré.

  // interiorTex toujours null : Option 2 (2026-09-28, PLAN_WORLD_BUILDER_REWORK.md §8) a tranché qu'un mur
  // n'a plus jamais de texture pré-faite, seulement le matériau procédural — décidée pour l'outil « Peindre
  // un mur », mais aucun chemin d'interface actuel ne peut plus jamais écrire wallInteriorTexId (la palette
  // de textures ne s'affiche qu'en mode room/wall, où materialFace ne devient jamais 'wallInterior') : la
  // règle est donc la seule cohérente pour toute écriture de wallAppearanceProfiles, pas seulement celle du
  // pinceau. Avant ce correctif, applyRoomWallAppearance() préservait encore un interiorTex hérité si
  // l'appelant en passait un (cas du panneau flottant Mur) — autorité dupliquée avec paintRoomWallEdges qui,
  // lui, le forçait déjà à null : un seul appelant appliquait Option 2, l'autre non.
  const normalized = {
    interiorTex: null,
    interiorMaterial: profileOrDefault(appearance?.interiorMaterial),
  }
  const remaining = (selectedRoom.wallAppearanceProfiles || []).flatMap(entry => {
    const retainedKeys = (entry?.edgeKeys || []).map(String).filter(key => !selectedSet.has(key))
    return retainedKeys.length > 0 ? [{ ...entry, edgeKeys: retainedKeys }] : []
  })
  const wallAppearanceProfiles = [
    ...remaining,
    {
      id: `wall-appearance:${selected.slice().sort().join('|')}`,
      edgeKeys: selected,
      ...normalized,
    },
  ]

  return {
    surfaceData: {
      ...next,
      rooms: {
        ...next.rooms,
        [roomId]: { ...selectedRoom, wallAppearanceProfiles },
      },
    },
    error: null,
    roomId,
    appearance: normalized,
  }
}

// ===================================================================
// API publique — peinture directe (case / tronçon / salle), outil « Peindre un mur »
// ===================================================================

// Distance (en cases) du point projeté sur l'axe du tronçon, depuis `run.from`.
// `run` a la forme retournée par roomBoundaryWallRuns/roomSelectableWallRuns : {from, to, axis, edgeKeys}.
export function roomWallRunOffsetAtPoint(run, point) {
  const x0 = Number(run?.from?.x)
  const z0 = Number(run?.from?.z)
  const x1 = Number(run?.to?.x)
  const z1 = Number(run?.to?.z)
  const px = Number(point?.x)
  const pz = Number(point?.z)
  if (![x0, z0, x1, z1, px, pz].every(Number.isFinite)) return null
  const dx = x1 - x0
  const dz = z1 - z0
  const length = Math.hypot(dx, dz)
  if (length <= 1e-7) return null
  return ((px - x0) * dx + (pz - z0) * dz) / length
}

// Clé de l'arête unitaire (une case de mur) à un offset donné le long d'un tronçon droit.
// Un arc n'a pas de case (courbe posée sur le tronçon d'origine) : renvoie null, l'appelant
// traite alors tout l'arc comme une seule unité (déjà le cas pour sa sélection ailleurs).
export function roomWallEdgeKeyAtOffset(run, offset) {
  const edgeKeys = Array.isArray(run?.edgeKeys) ? run.edgeKeys : []
  if (edgeKeys.length === 0 || run?.axis === 'arc' || !Number.isFinite(Number(offset))) return null
  const index = Math.max(0, Math.min(edgeKeys.length - 1, Math.floor(Number(offset))))
  return edgeKeys[index]
}

export function roomWallEdgeKeyAtPoint(run, point) {
  const offset = roomWallRunOffsetAtPoint(run, point)
  return offset === null ? null : roomWallEdgeKeyAtOffset(run, offset)
}

// Peint une ou plusieurs cases de mur (une case seule, ou tout un tronçon/arc) avec le matériau
// procédural actif de l'outil. Décision de Saar (2026-09-28) : cet outil n'a AUCUNE notion de
// texture pré-faite, jamais — contrairement à Salle/Mur qui offrent les deux. `surfaceMaterialMode`
// est forcé à 'procedural' ici, quoi que porte `tool` : un id de texture laissé par un autre mode ne
// doit jamais pouvoir influencer ce résultat (cause racine du bug précédent, pas un simple reset
// ponctuel côté UI qui aurait pu être recontourné).
export function paintRoomWallEdges(surfaceData, roomId, edgeKeys, tool) {
  const next = normalizeSurfaceData(surfaceData)
  const selected = [...new Set((edgeKeys || []).map(String))]
  if (selected.length === 0) return { surfaceData, error: 'Sélectionne au moins une case de mur.' }
  const material = makeSurfaceMaterial(
    { ...toolForMaterialFace(tool, 'wallInterior'), surfaceMaterialMode: 'procedural' },
    `${roomId}:wall-paint:${selected.slice().sort().join('|')}`,
  )
  return applyRoomWallAppearance(next, roomId, selected, {
    interiorTex: null,
    interiorMaterial: material,
  })
}

// Peint tous les murs d'une salle avec le matériau procédural actif de l'outil (jamais de texture,
// même principe que paintRoomWallEdges).
// clearOverrides=false (1er appel) : pose le défaut de salle, laisse les cases déjà personnalisées
// intactes (ne peint que ce qui n'a pas été touché à la main).
// clearOverrides=true (rappel explicite) : efface aussi les personnalisations existantes, la salle
// devient uniforme.
export function paintRoomWallRoom(surfaceData, roomId, tool, { clearOverrides = false } = {}) {
  const next = normalizeSurfaceData(surfaceData)
  const selectedRoom = next.rooms?.[roomId]
  if (!selectedRoom) return { surfaceData, error: 'La salle sélectionnée n’existe plus.' }
  const material = makeSurfaceMaterial(
    { ...toolForMaterialFace(tool, 'wallInterior'), surfaceMaterialMode: 'procedural' },
    `${roomId}:wall-paint:room`,
  )
  return {
    surfaceData: {
      ...next,
      rooms: {
        ...next.rooms,
        [roomId]: {
          ...selectedRoom,
          wallInteriorTex: null,
          wallInteriorMaterial: material,
          wallAppearanceProfiles: clearOverrides ? [] : (selectedRoom.wallAppearanceProfiles || []),
        },
      },
    },
    error: null,
    roomId,
    clearedOverrides: clearOverrides && (selectedRoom.wallAppearanceProfiles || []).length > 0,
  }
}

// ===================================================================
// API publique — roomToSurfaceToolPatch
// ===================================================================

export function roomToSurfaceToolPatch(room) {
  if (!room) return null
  const baseLevel = yToLevel(getRoomBaseY(room))
  const wallInterior = roomWallInteriorMaterial(room)
  const hasProceduralMaterial = !!(
    room.floorMaterial
    || room.ceilingMaterial
    || wallInterior
  )
  return {
    selectedRoomId: room.id,
    roomName: room.label || room.name || room.id,
    mode: 'room',
    surfaceMaterialMode: hasProceduralMaterial ? 'procedural' : 'texture',
    level: baseLevel,
    elevation: levelToY(baseLevel),
    roomHeightLevels: getRoomHeightLevels(room),
    wallHeightLevels: getRoomHeightLevels(room),
    floorThickness: getRoomFloorThickness(room),
    ceilingThickness: getRoomCeilingThickness(room),
    wallThickness: Math.max(1, Number(room.wallThickness) || 1),
    movementMultiplier: Math.max(0.05, Number(room.movementMultiplier) || 1),
    surfaceBlocking: room.barrierType || 'solid',
    materialFace: 'floor',
    floorPackId: null,
    ceilingPackId: null,
    wallInteriorPackId: null,
    floorTexId: room.floorTex || null,
    ceilingTexId: room.ceilingTex || null,
    wallInteriorTexId: roomWallInteriorTex(room),
    materialProfiles: {
      floor: profileOrDefault(room.floorMaterial),
      ceiling: profileOrDefault(room.ceilingMaterial, room.ceilingMaterial ? {} : { paint: '#6b7280' }),
      wallInterior: profileOrDefault(wallInterior),
    },
  }
}