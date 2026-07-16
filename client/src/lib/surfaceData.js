import {
  DEFAULT_SURFACE_MATERIAL_PRESET,
  makeProceduralMaterialDescriptor,
} from './proceduralMaterials.js'
import {
  buildMergedRoomVerticalProfile,
  intersectMultiPolygons,
  makeRoomBoundaryArc,
  multiPolygonArea,
  multiPolygonContainsPoint,
  multiPolygonGridCells,
  normalizeWallElevationProfile,
  roomBoundaryEdges,
  roomBoundaryWallRuns,
  roomCeilingRegions,
  roomEffectiveGridCells,
  roomGeometryArea,
  roomGeometryContainsPoint,
  roomGeometryIntersectionArea,
  roomHasEffectiveBoundaryEdge,
  roomInteriorFootprintAtY,
  roomMaximumHeightLevels,
  roomSliceAtLevel,
  roomVolumeContainsPoint,
  roomVerticalSlices,
  sampleWallArcGeometry,
  selectedRoomBoundaryChain,
  withWallCornerJoins,
} from '../../../shared/world/roomGeometry.js'
import { SURFACE_DATA_VERSION } from '../../../shared/world/surfaceDocument.js'

export const SURFACE_FINE = 4
export const STORY_HEIGHT = 2.5
export { SURFACE_DATA_VERSION }
export const getRoomBoundaryEdges = roomBoundaryEdges
export const getRoomBoundaryWallRuns = roomBoundaryWallRuns
const STATION_USED_PACK_ID = '6f3916a6-7c7b-45f7-a020-7d63b7a74176'
const STATION_USED_SPECIAL_RATE = 12
const DEFAULT_FLOOR_THICKNESS = 0.25
const DEFAULT_CEILING_HEIGHT = 2.5
const STAIR_STEPS_PER_CELL = 4
export const DEFAULT_SURFACE_DATA = {
  version: SURFACE_DATA_VERSION,
  fine: SURFACE_FINE,
  storyHeight: STORY_HEIGHT,
  rooms: {},
  floors: {},
  walls: {},
  ceilings: {},
  stairs: {},
  connectors: {},
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

function formatLevel(value) {
  const rounded = Math.round((Number(value) || 0) * 1000) / 1000
  if (Object.is(rounded, -0)) return '0'
  return String(rounded)
}

export function getToolElevation(tool) {
  if (Number.isFinite(Number(tool?.level))) {
    return clampNumber(Math.trunc(Number(tool.level)), -8, 16, 0) * STORY_HEIGHT
  }
  return clampNumber(tool?.elevation, -8, 16, 0)
}

export function getToolLevel(tool) {
  if (Number.isFinite(Number(tool?.level))) {
    return Math.trunc(clampNumber(tool.level, -8, 16, 0))
  }
  return Math.round(getToolElevation(tool) / STORY_HEIGHT)
}

export function levelToY(level) {
  return Math.trunc(clampNumber(level, -8, 16, 0)) * STORY_HEIGHT
}

export function yToLevel(y) {
  return Math.round((Number(y) || 0) / STORY_HEIGHT)
}

export function getToolRoomHeightLevels(tool) {
  return Math.max(1, Math.min(6, Number.parseInt(tool?.roomHeightLevels ?? tool?.wallHeightLevels, 10) || 1))
}

export function getToolWallHeightLevels(tool) {
  return Math.max(1, Math.min(6, Number.parseInt(tool?.wallHeightLevels ?? tool?.roomHeightLevels, 10) || 1))
}

export function getToolFloorThickness(tool) {
  return clampNumber(tool?.floorThickness, 0.05, 4, DEFAULT_FLOOR_THICKNESS)
}

export function getToolCeilingThickness(tool) {
  return clampNumber(tool?.ceilingThickness ?? tool?.floorThickness, 0.05, 4, DEFAULT_FLOOR_THICKNESS)
}

export function getToolCeilingHeight(tool) {
  return clampNumber(tool?.ceilingHeight ?? tool?.wallHeight, 0.25, 16, DEFAULT_CEILING_HEIGHT)
}

export function getToolStairRise(tool) {
  return clampNumber(tool?.stairRise, 0.25, 12, 2.5)
}

export function getToolMovementMultiplier(tool) {
  return clampNumber(tool?.movementMultiplier ?? tool?.movementCostMultiplier, 0.05, 100, 1)
}

export function getFloorThickness(floor) {
  return Math.max(0.05, Number(floor?.thickness) || DEFAULT_FLOOR_THICKNESS)
}

export function getCeilingThickness(ceiling) {
  return Math.max(0.05, Number(ceiling?.thickness) || DEFAULT_FLOOR_THICKNESS)
}

export function getFloorTopY(id, floor) {
  const { y } = parseFloorKey(id, floor)
  return y + getFloorThickness(floor) / 2
}

export function getSupportThickness(value) {
  return Math.max(0.05, Number(value) || DEFAULT_FLOOR_THICKNESS)
}

export function getWallBaseY(wall) {
  return Number(wall?.y) || 0
}

export function getToolWallThicknessFine(tool) {
  return Math.max(1, Math.min(8, Number.parseInt(tool?.wallThickness, 10) || 1))
}

export function getWallThicknessFine(wall) {
  return Math.max(1, Number(wall?.thickness) || 1)
}

export function getWallHalfThicknessFine(wall) {
  return getWallThicknessFine(wall) / 2
}

export function getWallFineBounds(wall) {
  if (!wall) return null

  const half = getWallHalfThicknessFine(wall)
  const rawX0 = Number(wall.x0)
  const rawX1 = Number(wall.x1)
  const rawZ0 = Number(wall.z0)
  const rawZ1 = Number(wall.z1)
  const x0 = Number.isFinite(rawX0) ? rawX0 : 0
  const x1 = Number.isFinite(rawX1) ? rawX1 : x0
  const z0 = Number.isFinite(rawZ0) ? rawZ0 : 0
  const z1 = Number.isFinite(rawZ1) ? rawZ1 : z0

  if (wall.axis === 'segment') {
    return {
      minX: Math.min(x0, x1) - half,
      maxX: Math.max(x0, x1) + half,
      minZ: Math.min(z0, z1) - half,
      maxZ: Math.max(z0, z1) + half,
    }
  }

  if (wall.axis === 'x') {
    const capStart = wall.capStart !== false
    const capEnd = wall.capEnd !== false
    return {
      minX: Math.min(x0, x1) - (capStart ? half : 0),
      maxX: Math.max(x0, x1) + (capEnd ? half : 0),
      minZ: z0 - half,
      maxZ: z0 + half,
    }
  }

  const capStart = wall.capStart !== false
  const capEnd = wall.capEnd !== false
  return {
    minX: x0 - half,
    maxX: x0 + half,
    minZ: Math.min(z0, z1) - (capStart ? half : 0),
    maxZ: Math.max(z0, z1) + (capEnd ? half : 0),
  }
}

export function getWallRenderBox(wall) {
  const fine = SURFACE_FINE
  const height = Math.max(0.5, Number(wall.height) || 2.5)
  const baseY = getWallBaseY(wall)

  if (wall.axis === 'segment') {
    const x0 = Number(wall.x0) / fine
    const x1 = Number(wall.x1) / fine
    const z0 = Number(wall.z0) / fine
    const z1 = Number(wall.z1) / fine
    const dx = x1 - x0
    const dz = z1 - z0
    const length = Math.hypot(dx, dz)
    if (!Number.isFinite(length) || length < 0.001) return null
    const thickness = getWallThicknessFine(wall) / fine
    const capStart = wall.capStart !== false ? thickness / 2 : 0
    const capEnd = wall.capEnd !== false ? thickness / 2 : 0
    const ux = dx / length
    const uz = dz / length
    const startX = x0 - ux * capStart
    const startZ = z0 - uz * capStart
    const endX = x1 + ux * capEnd
    const endZ = z1 + uz * capEnd
    return {
      position: [(startX + endX) / 2, baseY + height / 2, (startZ + endZ) / 2],
      args: [length + capStart + capEnd, height, thickness],
      rotationY: -Math.atan2(dz, dx),
    }
  }

  const bounds = getWallFineBounds(wall)
  if (!bounds) return null

  return {
    position: [
      (bounds.minX + bounds.maxX) / (2 * fine),
      baseY + height / 2,
      (bounds.minZ + bounds.maxZ) / (2 * fine),
    ],
    args: [
      Math.max(1 / fine, (bounds.maxX - bounds.minX) / fine),
      height,
      Math.max(1 / fine, (bounds.maxZ - bounds.minZ) / fine),
    ],
  }
}

function surfaceBlockingForTool(tool) {
  const type = tool?.surfaceBlocking || tool?.wallBlocking || 'solid'
  if (type === 'glass' || type === 'grate') {
    return {
      barrierType: type,
      blocksSight: false,
      blocksMovement: true,
      blocksWater: type !== 'grate',
    }
  }
  return {
    barrierType: 'solid',
    blocksSight: true,
    blocksMovement: true,
    blocksWater: true,
  }
}

function normalizeSurfaceMaterialPreset(tool) {
  return {
    ...DEFAULT_SURFACE_MATERIAL_PRESET,
    ...(tool?.materialPreset || tool?.proceduralMaterial || {}),
  }
}

function makeSurfaceMaterial(tool, seed) {
  if (tool?.surfaceMaterialMode === 'texture') return null
  const preset = normalizeSurfaceMaterialPreset(tool)
  // A unique procedural seed per cell forces the renderer to generate one
  // albedo map, normal map and relief geometry for every slab. A small,
  // deterministic pool keeps visible variation while allowing those costly
  // resources to be shared by the whole room.
  const variantSeed = tool?.autoVariants === false
    ? 'fixed'
    : `variant-${hashString(seed) % 4}`
  return makeProceduralMaterialDescriptor({
    ...preset,
    seed: `${preset.seed || DEFAULT_SURFACE_MATERIAL_PRESET.seed}:${variantSeed}`,
  })
}

function toolForMaterialFace(tool, face) {
  const preset = tool?.materialProfiles?.[face]
  if (!preset) return tool
  return { ...tool, materialPreset: preset }
}

function materialOrTextureForTool({ tool, packId, textureId, fallbackTexId, availableBlocks, seed }) {
  const material = makeSurfaceMaterial(tool, seed)
  if (material) return { material, tex: null }

  return {
    material: null,
    tex: pickSurfaceTexture({
      packId,
      textureId,
      fallbackTexId,
      availableBlocks,
      seed,
      autoVariants: tool?.autoVariants,
    }),
  }
}

export const floorKey = (x, z, y = 0) => {
  const level = formatLevel(y)
  return level === '0' ? `${x}:${z}` : `${x}:${z}:${level}`
}

export function parseFloorKey(id, floor) {
  const [rawX, rawZ, rawY] = String(id).split(':')
  const parsedY = floor?.y ?? Number(rawY || 0)
  return {
    x: Number(rawX),
    z: Number(rawZ),
    y: Number.isFinite(Number(parsedY)) ? Number(parsedY) : 0,
  }
}

export const ceilingKey = (x, z, baseY = 0, y = DEFAULT_CEILING_HEIGHT) => {
  const baseLevel = formatLevel(baseY)
  const level = formatLevel(y)
  return `${x}:${z}:${baseLevel}:${level}`
}

export function parseCeilingKey(id, ceiling) {
  const [rawX, rawZ, rawBaseY, rawY] = String(id).split(':')
  const parsedBaseY = ceiling?.baseY ?? Number(rawBaseY || 0)
  const parsedY = ceiling?.y ?? Number(rawY || DEFAULT_CEILING_HEIGHT)
  return {
    x: Number(rawX),
    z: Number(rawZ),
    baseY: Number.isFinite(Number(parsedBaseY)) ? Number(parsedBaseY) : 0,
    y: Number.isFinite(Number(parsedY)) ? Number(parsedY) : DEFAULT_CEILING_HEIGHT,
  }
}

export function normalizeSurfaceData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ...DEFAULT_SURFACE_DATA }
  const storyHeight = Number(data.storyHeight) || STORY_HEIGHT
  const sourceRooms = data.rooms && typeof data.rooms === 'object' && !Array.isArray(data.rooms) ? data.rooms : {}
  const rooms = Object.fromEntries(Object.entries(sourceRooms).map(([id, room]) => {
    const canonicalRoom = { ...(room || {}) }
    const slices = canonicalRoom?.verticalProfile?.slices
    if (!Array.isArray(slices) || slices.length === 0) return [id, canonicalRoom]
    if (!slices.every((slice, index) => Number(slice?.offset) === index)) return [id, canonicalRoom]
    const heightLevels = slices.length
    const height = heightLevels * storyHeight
    return Number(canonicalRoom.heightLevels) === heightLevels && Number(canonicalRoom.height) === height
      ? [id, canonicalRoom]
      : [id, { ...canonicalRoom, heightLevels, height }]
  }))
  return {
    version: Math.max(SURFACE_DATA_VERSION, data.version || 2),
    fine: data.fine || SURFACE_FINE,
    storyHeight,
    rooms,
    floors: data.floors && typeof data.floors === 'object' && !Array.isArray(data.floors) ? data.floors : {},
    walls: data.walls && typeof data.walls === 'object' && !Array.isArray(data.walls) ? data.walls : {},
    ceilings: data.ceilings && typeof data.ceilings === 'object' && !Array.isArray(data.ceilings) ? data.ceilings : {},
    stairs: data.stairs && typeof data.stairs === 'object' && !Array.isArray(data.stairs) ? data.stairs : {},
    connectors: data.connectors && typeof data.connectors === 'object' && !Array.isArray(data.connectors) ? data.connectors : {},
  }
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


export function hasSurfaceContent(data) {
  const surface = normalizeSurfaceData(data)
  return Object.keys(surface.rooms).length > 0
    || Object.keys(surface.floors).length > 0
    || Object.keys(surface.walls).length > 0
    || Object.keys(surface.ceilings).length > 0
    || Object.keys(surface.stairs).length > 0
    || Object.keys(surface.connectors).length > 0
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

function hashString(value) {
  let hash = 2166136261
  const str = String(value)
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 2246822507)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 3266489909)
  hash ^= hash >>> 16
  return hash >>> 0
}

export function pickTextureVariant(baseTexId, availableBlocks, seed, autoVariants) {
  if (!baseTexId || !autoVariants) return baseTexId
  const base = availableBlocks?.find(block => block.id === baseTexId)
  if (!base?.category_id) return baseTexId

  const pool = availableBlocks
    .filter(block => !block.deprecated && block.category_id === base.category_id)
    .map(block => block.id)
  if (pool.length <= 1) return baseTexId

  return pool[hashString(seed) % pool.length] || baseTexId
}

export function pickTextureFromPackage(packId, availableBlocks, seed, autoVariants) {
  if (!packId) return null
  const pool = (availableBlocks || [])
    .filter(block => !block.deprecated && String(block.pack_id) === String(packId))
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || String(a.label).localeCompare(String(b.label)))
  if (pool.length === 0) return null
  if (!autoVariants || pool.length === 1) return pool[0].id

  if (usesSparseSpecialVariants(pool)) {
    const normal = pool.find(block => Number(block.sort_order) === 0) || pool[0]
    const specials = pool.filter(block => block.id !== normal.id)
    if (specials.length === 0) return normal.id
    const isSpecial = hashString(`${seed}:special-roll`) % STATION_USED_SPECIAL_RATE === 0
    if (!isSpecial) return normal.id
    return specials[hashString(`${seed}:special-choice`) % specials.length]?.id || normal.id
  }

  const weighted = pool.map(block => ({
    id: block.id,
    weight: textureVariantWeight(block),
  }))
  const totalWeight = weighted.reduce((sum, block) => sum + block.weight, 0)
  let ticket = hashString(seed) % totalWeight
  for (const block of weighted) {
    if (ticket < block.weight) return block.id
    ticket -= block.weight
  }
  return weighted[0]?.id || null
}

function isStationFloorPackage(block) {
  const packName = String(block?.pack_name || '').toLowerCase()
  const packLabel = String(block?.pack_label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return packName === 'sol-station-use' || packLabel.includes('sol station')
}

function usesSparseSpecialVariants(pool) {
  if (!pool?.length) return false
  if (String(pool[0]?.pack_id) === STATION_USED_PACK_ID || isStationFloorPackage(pool[0])) return true

  const category = String(pool[0]?.category_label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const hasPrimary = pool.some(block => Number(block.sort_order) === 0)
  const hasSpecials = pool.length > 1
  const hasTrame = pool.some(block => String(block.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('trame'))
  return category === 'sol' && hasPrimary && hasSpecials && hasTrame
}

function textureVariantWeight(block) {
  const explicit = Math.max(1, Number.parseInt(block?.variant_weight, 10) || 1)
  const packName = String(block?.pack_name || '').toLowerCase()
  const packLabel = String(block?.pack_label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const label = String(block?.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  if (packName === 'sol-station-use' || packLabel.includes('sol station')) {
    if (label.includes('trame') || Number(block?.sort_order) === 0) return Math.max(explicit, 33)
    return 1
  }

  return explicit
}

function pickSurfaceTexture({ packId, textureId, fallbackTexId, availableBlocks, seed, autoVariants }) {
  const directPackTexture = pickTextureFromPackage(packId, availableBlocks, seed, autoVariants)
  if (directPackTexture) return directPackTexture

  const baseTexId = textureId || fallbackTexId
  const base = (availableBlocks || []).find(block => String(block.id) === String(baseTexId))
  const basePackTexture = pickTextureFromPackage(base?.pack_id, availableBlocks, seed, autoVariants)
  if (basePackTexture) return basePackTexture

  return pickTextureVariant(baseTexId, availableBlocks, seed, autoVariants)
}

export function normalizeCellSelection(selection) {
  if (!selection?.start || !selection?.end) return null
  const minX = Math.min(selection.start.x, selection.end.x)
  const maxX = Math.max(selection.start.x, selection.end.x)
  const minZ = Math.min(selection.start.z, selection.end.z)
  const maxZ = Math.max(selection.start.z, selection.end.z)
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX + 1,
    depth: maxZ - minZ + 1,
  }
}

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
      const tileFootprint = [[[
        [x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1], [x, z],
      ]]]
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

function makeWallSegment(wall, tool, activeMaterial, availableBlocks) {
  const y = getToolElevation(tool)
  const id = `wall:${wall.axis}:${wall.x0}:${wall.z0}:${wall.x1}:${wall.z1}:${wall.thickness}:${formatLevel(y)}`
  const appearance = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'wallInterior'),
    packId: tool?.wallInteriorPackId,
    textureId: tool?.wallInteriorTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:wall`,
  })
  if (!appearance.tex && !appearance.material) return null

  return {
    ...wall,
    id,
    y,
    supportThickness: getToolFloorThickness(tool),
    ...surfaceBlockingForTool(tool),
    ...(appearance.tex ? { frontTex: appearance.tex, backTex: appearance.tex } : {}),
    ...(appearance.material ? { frontMaterial: appearance.material, backMaterial: appearance.material } : {}),
  }
}

export function makeWallsFromDrag(start, end, tool, activeMaterial, availableBlocks) {
  if (!start || !end) return null
  const fine = SURFACE_FINE
  const dx = end.fx - start.fx
  const dz = end.fz - start.fz
  const axis = Math.abs(dx) >= Math.abs(dz) ? 'x' : 'z'

  const thickness = getToolWallThicknessFine(tool)
  const height = Number.isFinite(Number(tool?.wallHeightLevels))
    ? getToolWallHeightLevels(tool) * STORY_HEIGHT
    : Math.max(0.5, Math.min(15, Number(tool?.wallHeight) || STORY_HEIGHT))
  const segments = []

  if (tool?.wallShape === 'curve') {
    const distanceFine = Math.hypot(dx, dz)
    if (distanceFine < 0.01) return []
    const distanceWorld = distanceFine / fine
    const curveOffsetWorld = Math.max(-12, Math.min(12, Number(tool?.wallCurveOffset) || 0))
    const perpendicularX = -dz / distanceFine
    const perpendicularZ = dx / distanceFine
    const controlX = (start.fx + end.fx) / 2 + perpendicularX * curveOffsetWorld * fine
    const controlZ = (start.fz + end.fz) / 2 + perpendicularZ * curveOffsetWorld * fine
    const sampleCount = Math.max(2, Math.min(96, Math.ceil((distanceWorld + Math.abs(curveOffsetWorld)) * 4)))
    const pointAt = t => {
      const inverse = 1 - t
      return {
        x: Math.round((inverse * inverse * start.fx + 2 * inverse * t * controlX + t * t * end.fx) * 10000) / 10000,
        z: Math.round((inverse * inverse * start.fz + 2 * inverse * t * controlZ + t * t * end.fz) * 10000) / 10000,
      }
    }

    for (let index = 0; index < sampleCount; index += 1) {
      const from = pointAt(index / sampleCount)
      const to = pointAt((index + 1) / sampleCount)
      const wall = makeWallSegment({
        axis: 'segment',
        x0: from.x,
        x1: to.x,
        z0: from.z,
        z1: to.z,
        thickness,
        height,
        capStart: true,
        capEnd: true,
        curve: {
          kind: 'quadratic',
          index,
          count: sampleCount,
          controlX,
          controlZ,
        },
      }, tool, activeMaterial, availableBlocks)
      if (wall) segments.push(wall)
    }
    return segments
  }

  if (axis === 'x') {
    const xStart = Math.min(start.fx, end.fx)
    let xEnd = Math.max(start.fx, end.fx)
    if (xStart === xEnd) xEnd = xStart + fine
    const z = start.fz
    for (let x0 = xStart, index = 0; x0 < xEnd; x0 += fine, index += 1) {
      const x1 = Math.min(x0 + fine, xEnd)
      const wall = makeWallSegment({
        axis,
        x0,
        x1,
        z0: z,
        z1: z,
        thickness,
        height,
        capStart: index === 0,
        capEnd: x1 >= xEnd,
      }, tool, activeMaterial, availableBlocks)
      if (wall) segments.push(wall)
    }
  } else {
    const zStart = Math.min(start.fz, end.fz)
    let zEnd = Math.max(start.fz, end.fz)
    if (zStart === zEnd) zEnd = zStart + fine
    const x = start.fx
    for (let z0 = zStart, index = 0; z0 < zEnd; z0 += fine, index += 1) {
      const z1 = Math.min(z0 + fine, zEnd)
      const wall = makeWallSegment({
        axis,
        x0: x,
        x1: x,
        z0,
        z1,
        thickness,
        height,
        capStart: index === 0,
        capEnd: z1 >= zEnd,
      }, tool, activeMaterial, availableBlocks)
      if (wall) segments.push(wall)
    }
  }

  return segments
}

function wallCoversPanel(existing, candidate) {
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

  const existingBottom = getWallBaseY(existing)
  const existingTop = existingBottom + Math.max(0.5, Number(existing.height) || STORY_HEIGHT)
  const candidateBottom = getWallBaseY(candidate)
  const candidateTop = candidateBottom + Math.max(0.5, Number(candidate.height) || STORY_HEIGHT)
  return existingBottom <= candidateBottom + epsilon && existingTop >= candidateTop - epsilon
}

function addMissingWalls(nextWalls, candidates) {
  let changed = false
  for (const candidate of candidates || []) {
    const covered = Object.values(nextWalls).some(existing => wallCoversPanel(existing, candidate))
    if (covered) continue
    nextWalls[candidate.id] = candidate
    changed = true
  }
  return changed
}

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

function parseRoomCell(value) {
  if (typeof value === 'string') {
    const [rawX, rawZ] = value.split(':')
    const x = Number(rawX)
    const z = Number(rawZ)
    if (Number.isInteger(x) && Number.isInteger(z)) return { x, z }
  }
  if (value && typeof value === 'object') {
    const x = Number(value.x)
    const z = Number(value.z)
    if (Number.isInteger(x) && Number.isInteger(z)) return { x, z }
  }
  return null
}

export function roomCellKey(x, z) {
  return `${Math.trunc(Number(x) || 0)}:${Math.trunc(Number(z) || 0)}`
}

function sortRoomCells(cells) {
  return [...cells].sort((left, right) => left.z - right.z || left.x - right.x)
}

export function getRoomFootprintCells(room) {
  if (Array.isArray(room?.cells) && room.cells.length > 0) {
    const unique = new Map()
    for (const value of room.cells) {
      const cell = parseRoomCell(value)
      if (cell) unique.set(roomCellKey(cell.x, cell.z), cell)
    }
    if (unique.size > 0) return sortRoomCells(unique.values())
  }

  const bounds = rawRoomBounds(room)
  const cells = []
  for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) cells.push({ x, z })
  }
  return cells
}

export function roomIncludesCell(room, x, z) {
  const key = roomCellKey(x, z)
  return getRoomFootprintCells(room).some(cell => roomCellKey(cell.x, cell.z) === key)
}

export function roomFootprintRectangles(room) {
  const cells = getRoomFootprintCells(room)
  const available = new Set(cells.map(cell => roomCellKey(cell.x, cell.z)))
  const used = new Set()
  const rectangles = []

  for (const cell of cells) {
    const startKey = roomCellKey(cell.x, cell.z)
    if (used.has(startKey)) continue

    let width = 1
    while (available.has(roomCellKey(cell.x + width, cell.z))
      && !used.has(roomCellKey(cell.x + width, cell.z))) width += 1

    let depth = 1
    let canGrow = true
    while (canGrow) {
      for (let dx = 0; dx < width; dx += 1) {
        const key = roomCellKey(cell.x + dx, cell.z + depth)
        if (!available.has(key) || used.has(key)) {
          canGrow = false
          break
        }
      }
      if (canGrow) depth += 1
    }

    for (let dz = 0; dz < depth; dz += 1) {
      for (let dx = 0; dx < width; dx += 1) used.add(roomCellKey(cell.x + dx, cell.z + dz))
    }
    rectangles.push({
      minX: cell.x,
      maxX: cell.x + width - 1,
      minZ: cell.z,
      maxZ: cell.z + depth - 1,
      width,
      depth,
    })
  }

  return rectangles
}

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

export function getRoomBaseY(room) {
  if (Number.isFinite(Number(room?.y))) return Number(room.y)
  return levelToY(room?.level)
}

export function getRoomHeightLevels(room) {
  return Math.max(1, Math.min(12, roomMaximumHeightLevels(room, STORY_HEIGHT)))
}

export function getRoomSlice(room, displayLevel, roomLookup = {}) {
  const baseLevel = yToLevel(getRoomBaseY(room))
  return roomSliceAtLevel(room, Number(displayLevel) - baseLevel, roomLookup, STORY_HEIGHT)
}

export function isWorldPointVisibleAtLevel(data, displayLevel, x, z, y, cameraRoomId = null) {
  if (displayLevel === null || displayLevel === undefined) return true
  if (yToLevel(y) <= displayLevel) return true
  return pointBelongsToRoomVolume(data, cameraRoomId, x, z, y)
}

export function isWorldInteriorPointVisibleAtLevel(data, displayLevel, x, z, y, cameraRoomId = null) {
  if (displayLevel === null || displayLevel === undefined) return true
  if (yToLevel(y) === Number(displayLevel)) return true
  return pointBelongsToRoomVolume(data, cameraRoomId, x, z, y)
}

function pointBelongsToRoomVolume(data, roomId, x, z, y) {
  const room = roomId ? data?.rooms?.[roomId] : null
  if (!room) return false
  return roomVolumeContainsPoint(
    { id: roomId, ...room },
    { x, y, z },
    data.rooms,
    STORY_HEIGHT,
  )
}

export function entityUsesWallPlacement(entity, blueprint) {
  const instanceMode = entity?.state && typeof entity.state === 'object'
    ? entity.state?.placement?.mode
    : null
  const blueprintMode = blueprint?.geometry?.placementMode || blueprint?.geometry?.placement_mode
  return instanceMode === 'wall' || blueprintMode === 'wall'
}

export function getRoomHeight(room) {
  return getRoomHeightLevels(room) * STORY_HEIGHT
}

export function getRoomTopY(room) {
  return getRoomBaseY(room) + getRoomHeight(room)
}

export function getRoomFloorThickness(room) {
  return Math.max(0.05, Number(room?.floorThickness) || DEFAULT_FLOOR_THICKNESS)
}

export function getRoomCeilingThickness(room) {
  return Math.max(0.05, Number(room?.ceilingThickness) || getRoomFloorThickness(room))
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
    wallInterior: profiles.wallInterior || tool?.materialPreset,
  }
}

function profileOrDefault(profile, patch = {}) {
  return {
    ...DEFAULT_SURFACE_MATERIAL_PRESET,
    ...(profile || {}),
    ...patch,
  }
}

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

function makeRoomFromSelection(_surfaceData, selection, tool, activeMaterial, availableBlocks) {
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

export function roomWallSegments(room, roomLookup = null) {
  if (!room) return []
  const roomId = room.id || 'room'
  const rooms = roomLookup || { [roomId]: room }
  return roomsWallSegments(rooms).filter(wall => wall.roomIds?.includes(roomId))
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
    ? Array.from({ length: curveLevelCount }, (_, index) => (
        from + (to - from) * index / Math.max(1, curveLevelCount - 1)
      ))
    : [from, to]
  if (profileTypes.includes('faceted') && from < 0.5 && to > 0.5) levels.push(0.5)
  return [...new Set(levels)].sort((left, right) => left - right)
}

export function wallOpeningVerticalRange(connector, wall) {
  if (!connector || !wall) return null
  const wallBottom = Number.isFinite(Number(wall.y)) ? Number(wall.y) : 0
  const wallHeight = Math.max(0.5, Number(wall.height) || STORY_HEIGHT)
  const wallTop = wallBottom + wallHeight
  const connectorBottom = Number.isFinite(Number(connector.y)) ? Number(connector.y) : wallBottom
  const geometry = connector.modelGeometry || {}
  const connectorHeight = Math.max(0.5, Number(geometry.height) || Number(connector.height) || 2)
  const bottom = Math.max(wallBottom, connectorBottom)
  const top = Math.min(wallTop, connectorBottom + connectorHeight)
  if (top <= bottom + 0.01) return null
  return { wallBottom, wallTop, bottom, top }
}

function connectorCommonBlocking(type, state = 'closed') {
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

function connectorModelFromTool(tool) {
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

function connectorModelGeometryFromTool(tool) {
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

function connectorModelOuterWidthFromTool(tool, modelGeometry) {
  const explicitCut = Number(modelGeometry.wallCutWidth || modelGeometry.footprintWidth || modelGeometry.footprint_width_m)
  if (explicitCut) return Math.max(0.25, explicitCut)

  const declaredWidth = Math.max(0.25, Number(modelGeometry.width) || 1)
  const openingWidth = Number(modelGeometry.openingWidth || modelGeometry.doorPanelWidth || modelGeometry.door_panel_width_m)
  if (openingWidth && declaredWidth > openingWidth + 0.01) return declaredWidth

  const border = inferredFuturisticDoorBorderFromTool(tool)
  return declaredWidth + border * 2
}

function clampPointOnPanel(value, min, max) {
  return clampNumber(value, min, max, (min + max) / 2)
}

function wallPointDistanceToPanel(wallPoint, panel) {
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

function normalizeDoorRotation(value) {
  const halfTurn = Math.PI
  const normalized = ((Number(value) % halfTurn) + halfTurn) % halfTurn
  return Math.abs(normalized - halfTurn) < 1e-8 ? 0 : normalized
}

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
  const connectorType = ['window', 'screen-window'].includes(tool?.connectorType) ? tool.connectorType : 'door'
  const state = tool?.connectorState || (connectorType === 'door' ? 'closed' : 'transparent')
  const modelGeometry = connectorModelGeometryFromTool(tool)
  const modelWidth = connectorModelOuterWidthFromTool(tool, modelGeometry)
  const modelDepth = Math.max(0.05, Number(modelGeometry.depth) || 0.25)
  const modelHeight = Math.max(0.5, Number(modelGeometry.height) || Math.min(2, STORY_HEIGHT * 0.9))
  const declaredOpeningBottom = Number(modelGeometry.openingBottom ?? modelGeometry.opening_bottom_m)
  const openingBottom = connectorType === 'door'
    ? 0
    : Math.max(0, Number.isFinite(declaredOpeningBottom) ? declaredOpeningBottom : STORY_HEIGHT * 0.2)
  const connectorY = panel.y + openingBottom
  const declaredWindowStates = Array.isArray(modelGeometry.allowedStates)
    ? modelGeometry.allowedStates.map(String)
    : []
  const allowedWindowStates = connectorType === 'screen-window'
    ? ['transparent', ...['opaque', 'mirror'].filter(windowState => (
        declaredWindowStates.includes(windowState)
          || (windowState === 'opaque' && tool?.windowOpaqueEnabled === true)
          || (windowState === 'mirror' && tool?.windowMirrorEnabled === true)
      ))]
    : null
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
      type: connectorType,
      level,
      y: connectorY,
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
      mountElevationProfileMode: panel.elevationProfileMode || null,
      mountElevationProfile: panel.elevationProfile || null,
      mountFrontElevationProfile: panel.frontElevationProfile || null,
      mountBackElevationProfile: panel.backElevationProfile || null,
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
      ...(connectorType === 'screen-window' ? {
        allowedStates: allowedWindowStates,
        modelFacing: 'front',
      } : {}),
      movementMultiplier: getToolMovementMultiplier(tool),
      ...connectorModelFromTool(tool),
      ...(connectorType === 'door'
        ? connectorCommonBlocking('door', state)
        : { blocksMovement: true, blocksSight: false, blocksWater: true, blocksGas: true, barrierType: 'glass' }),
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
    type: connectorType,
    level,
    y: connectorY,
    axis: panel.axis,
    x0,
    x1,
    z0,
    z1,
    alongCenter: center,
    thickness: panel.thickness,
    mountElevationProfileMode: panel.elevationProfileMode || null,
    mountElevationProfile: panel.elevationProfile || null,
    mountFrontElevationProfile: panel.frontElevationProfile || null,
    mountBackElevationProfile: panel.backElevationProfile || null,
    width: modelWidth,
    depth: modelDepth,
    height: modelHeight,
    roomId: selectedRoomId || panel.roomIds?.[0] || null,
    roomIds: panel.roomIds || [],
    state,
    ...(connectorType === 'screen-window' ? {
      allowedStates: allowedWindowStates,
      modelFacing: 'front',
    } : {}),
    movementMultiplier: getToolMovementMultiplier(tool),
    ...connectorModelFromTool(tool),
    ...(connectorType === 'door'
      ? connectorCommonBlocking('door', state)
      : { blocksMovement: true, blocksSight: false, blocksWater: true, blocksGas: true, barrierType: 'glass' }),
  }
}

export function applyDoorConnector(surfaceData, wallPoint, tool = {}) {
  const connector = makeDoorConnectorFromWallPoint(surfaceData, wallPoint, tool)
  if (!connector) return surfaceData
  const next = normalizeSurfaceData(surfaceData)
  return {
    ...next,
    version: SURFACE_DATA_VERSION,
    connectors: {
      ...next.connectors,
      [connector.id]: connector,
    },
  }
}

function horizontalSurfaceRoomsAtCell(surface, cell, y) {
  return Object.entries(surface.rooms).flatMap(([id, room]) => {
    if (!roomIncludesCell(room, cell.x, cell.z)) return []
    const ownsFloor = room.floorEnabled !== false && sameLevel(getRoomBaseY(room), y)
    const ownsCeiling = room.ceilingEnabled !== false && sameLevel(getRoomTopY(room), y)
    return ownsFloor || ownsCeiling ? [{ id, room }] : []
  })
}

export function makeSkylightConnectorFromCell(surfaceData, cell, tool = {}) {
  if (!cell) return null
  const surface = normalizeSurfaceData(surfaceData)
  const level = getToolLevel(tool)
  const y = levelToY(level)
  const geometry = connectorModelGeometryFromTool(tool)
  let width = Math.max(1, Math.round(Number(geometry.width) || 1))
  let depth = Math.max(1, Math.round(Number(geometry.depth) || 1))
  const rotated = Boolean(tool?.connectorRotationQuarterTurns % 2)
  if (rotated) [width, depth] = [depth, width]
  const x = Math.trunc(Number(cell.x))
  const z = Math.trunc(Number(cell.z))
  const ownerRooms = new Map()
  for (let dz = 0; dz < depth; dz += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      const hits = horizontalSurfaceRoomsAtCell(surface, { x: x + dx, z: z + dz }, y)
      if (hits.length === 0) return null
      for (const hit of hits) {
        if ((hit.room.boundaryArcs || []).length > 0 || (hit.room.geometryClipRoomIds || []).length > 0) return null
        ownerRooms.set(hit.id, hit.room)
      }
    }
  }
  const selectedRoomId = tool?.selectedRoomId
  const ownerRoomIds = [...ownerRooms.keys()]
  const primaryRoomId = ownerRooms.has(selectedRoomId) ? selectedRoomId : ownerRoomIds[0]
  const id = `connector:skylight:${x}:${z}:${level}:${width}x${depth}`
  return {
    id,
    type: 'skylight',
    level,
    x,
    z,
    y,
    width,
    depth,
    height: Math.max(0.04, Number(geometry.height) || 0.1),
    rotationY: rotated ? Math.PI / 2 : 0,
    roomId: primaryRoomId,
    roomIds: ownerRoomIds,
    state: 'transparent',
    allowedStates: ['transparent'],
    ...connectorModelFromTool(tool),
    blocksMovement: true,
    blocksSight: false,
    blocksWater: true,
    blocksGas: true,
    barrierType: 'glass',
  }
}

export function applySkylightConnector(surfaceData, cell, tool = {}) {
  const connector = makeSkylightConnectorFromCell(surfaceData, cell, tool)
  if (!connector) return surfaceData
  const next = normalizeSurfaceData(surfaceData)
  return {
    ...next,
    version: SURFACE_DATA_VERSION,
    connectors: { ...next.connectors, [connector.id]: connector },
  }
}

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
    version: SURFACE_DATA_VERSION,
    connectors: {
      ...next.connectors,
      [connector.id]: connector,
    },
  }
}

function supportTopAt(surface, cell, level, fallbackThickness) {
  const roomHit = findRoomAtCell(surface, cell, level)
  if (roomHit?.room) return levelToY(level) + getRoomFloorThickness(roomHit.room) / 2
  const floor = surface.floors?.[floorKey(cell.x, cell.z, levelToY(level))]
  return levelToY(level) + (floor ? getFloorThickness(floor) : fallbackThickness) / 2
}

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
    version: SURFACE_DATA_VERSION,
    connectors: {
      ...next.connectors,
      [connector.id]: connector,
    },
  }
}

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
  if (!['door', 'window', 'screen-window'].includes(connector?.type)) return false
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
    return { surfaceData, error: 'Déplace ou supprime d’abord l’ouverture rigide placée sur ces murs.' }
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
    surfaceData: { ...next, version: SURFACE_DATA_VERSION, rooms },
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
  return changed ? { ...next, version: SURFACE_DATA_VERSION, rooms } : surfaceData
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
      return { surfaceData, error: 'Déplace ou supprime l’ouverture rigide avant de modifier le profil vertical de ce mur.' }
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
    surfaceData: { ...next, version: SURFACE_DATA_VERSION, rooms },
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
  const normalized = {
    interiorTex: appearance?.interiorTex || null,
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
      version: SURFACE_DATA_VERSION,
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

function surfaceFeatureReferencesRoom(feature, roomId) {
  const target = String(roomId)
  if (feature?.roomId != null && String(feature.roomId) === target) return true
  return Array.isArray(feature?.roomIds)
    && feature.roomIds.some(value => String(value) === target)
}

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

  return { ...next, version: SURFACE_DATA_VERSION, rooms, connectors }
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

function sameRoomFloor(left, right) {
  return sameLevel(getRoomBaseY(left), getRoomBaseY(right))
}

function uniqueObjectsById(items) {
  return [...new Map(items.filter(Boolean).map(item => [item.id, item])).values()]
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
        version: SURFACE_DATA_VERSION,
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
    surfaceData: { ...next, version: SURFACE_DATA_VERSION, rooms, connectors },
    error: null,
    roomId,
    mergedRoomIds: [absorbedId],
  }
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

    // Une frontière courbe est prioritaire sur une nouvelle empreinte rectangulaire. Les deux
    // broadphases peuvent partager des cases ; geometryClipRoomIds garantit l'exclusivité réelle.
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
    version: SURFACE_DATA_VERSION,
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
  const wallInterior = materialOrTextureForTool({
    tool: toolForMaterialFace(toolWithProfiles, 'wallInterior'),
    packId: tool?.wallInteriorPackId,
    textureId: tool?.wallInteriorTexId || roomWallInteriorTex(room),
    fallbackTexId: roomWallInteriorTex(room) || activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:wall:interior`,
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
    wallInteriorTex: wallInterior.tex,
    floorMaterial: floorAppearance.material,
    ceilingMaterial: ceilingAppearance.material,
    wallInteriorMaterial: wallInterior.material,
  }

  if (JSON.stringify(updated) === JSON.stringify(room)) return surfaceData

  return {
    ...next,
    version: SURFACE_DATA_VERSION,
    rooms: {
      ...next.rooms,
      [roomId]: updated,
    },
  }
}

export function makeWallFromDrag(start, end, tool, activeMaterial, availableBlocks) {
  return makeWallsFromDrag(start, end, tool, activeMaterial, availableBlocks)?.[0] || null
}

export function applyWallDrag(surfaceData, start, end, tool, activeMaterial, availableBlocks) {
  const next = normalizeSurfaceData(surfaceData)
  const nextWalls = { ...next.walls }
  const baseLevel = getToolLevel(tool)
  const heightLevels = Number.isFinite(Number(tool?.wallHeightLevels)) ? getToolWallHeightLevels(tool) : 1
  let changed = false

  for (let offset = 0; offset < heightLevels; offset += 1) {
    const panelTool = Number.isFinite(Number(tool?.wallHeightLevels))
      ? { ...tool, level: baseLevel + offset, wallHeightLevels: 1 }
      : tool
    const panels = makeWallsFromDrag(start, end, panelTool, activeMaterial, availableBlocks)
    if (addMissingWalls(nextWalls, panels)) changed = true
  }

  return changed ? { ...next, walls: nextWalls } : surfaceData
}

export function makeStairFromSelection(selection, tool, activeMaterial, availableBlocks) {
  const area = normalizeCellSelection(selection)
  if (!area) return null

  const dx = selection.end.x - selection.start.x
  const dz = selection.end.z - selection.start.z
  const axis = Math.abs(dx) >= Math.abs(dz) ? 'x' : 'z'
  const dir = axis === 'x'
    ? (dx >= 0 ? 1 : -1)
    : (dz >= 0 ? 1 : -1)
  const run = axis === 'x' ? area.width : area.depth
  const width = axis === 'x' ? area.depth : area.width
  const steps = Math.max(1, Math.min(32, Number.parseInt(tool?.stairSteps, 10) || run))
  const y = getToolElevation(tool)
  const rise = getToolStairRise(tool)
  const topY = y + rise
  const supportThickness = getToolFloorThickness(tool)
  const id = `stair:${axis}:${dir}:${area.minX}:${area.minZ}:${area.maxX}:${area.maxZ}:${formatLevel(y)}:${formatLevel(topY)}`
  const { tex, material } = materialOrTextureForTool({
    tool,
    packId: tool?.stairPackId || tool?.floorPackId,
    textureId: tool?.stairTexId || tool?.floorTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:steps`,
  })
  if (!tex && !material) return null

  return {
    id,
    axis,
    dir,
    minX: area.minX,
    maxX: area.maxX,
    minZ: area.minZ,
    maxZ: area.maxZ,
    width,
    run,
    steps,
    visualSteps: steps * STAIR_STEPS_PER_CELL,
    riseSteps: steps * STAIR_STEPS_PER_CELL,
    y,
    topY,
    rise,
    supportThickness,
    walkable: true,
    connectsLevels: true,
    movementMode: 'stairs',
    movementMultiplier: getToolMovementMultiplier(tool),
    ...surfaceBlockingForTool(tool),
    ...(tex ? { tex } : {}),
    ...(material ? { material } : {}),
  }
}

export function stairStepBoxes(stair) {
  if (!stair) return []
  const steps = Math.max(1, Number.parseInt(stair.steps, 10) || 1)
  const visualSteps = Math.max(steps, Number.parseInt(stair.visualSteps, 10) || steps * STAIR_STEPS_PER_CELL)
  const riseSteps = Math.max(steps, Number.parseInt(stair.riseSteps, 10) || visualSteps)
  const baseY = (Number(stair.y) || 0) + getSupportThickness(stair.supportThickness) / 2
  const rise = Math.max(0.01, Number(stair.rise) || ((Number(stair.topY) || 0) - baseY) || 0.25)
  const run = Math.max(1, Number(stair.run) || (stair.axis === 'x'
    ? (stair.maxX - stair.minX + 1)
    : (stair.maxZ - stair.minZ + 1)))
  const stepRun = run / visualSteps
  const boxes = []

  for (let i = 0; i < visualSteps; i += 1) {
    const heightIndex = Math.min(riseSteps, Math.ceil(((i + 1) / visualSteps) * riseSteps))
    const top = baseY + (heightIndex / riseSteps) * rise
    const height = Math.max(0.05, top - baseY)
    const alongStart = stair.dir >= 0
      ? (stair.axis === 'x' ? stair.minX : stair.minZ) + i * stepRun
      : (stair.axis === 'x' ? stair.maxX + 1 : stair.maxZ + 1) - (i + 1) * stepRun
    const alongCenter = alongStart + stepRun / 2

    if (stair.axis === 'x') {
      boxes.push({
        position: [alongCenter, baseY + height / 2, stair.minZ + (stair.maxZ - stair.minZ + 1) / 2],
        args: [stepRun, height, stair.maxZ - stair.minZ + 1],
      })
    } else {
      boxes.push({
        position: [stair.minX + (stair.maxX - stair.minX + 1) / 2, baseY + height / 2, alongCenter],
        args: [stair.maxX - stair.minX + 1, height, stepRun],
      })
    }
  }

  return boxes
}

export function applyStairSelection(surfaceData, selection, tool, activeMaterial, availableBlocks) {
  const stair = makeStairFromSelection(selection, tool, activeMaterial, availableBlocks)
  if (!stair) return surfaceData

  const next = normalizeSurfaceData(surfaceData)
  return {
    ...next,
    stairs: {
      ...next.stairs,
      [stair.id]: stair,
    },
  }
}

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
  if (['door', 'window', 'screen-window'].includes(connector.type)) {
    return wallIntersectsCellArea(connector, area)
  }
  const x = Math.trunc(Number(connector.x) || 0)
  const z = Math.trunc(Number(connector.z) || 0)
  const width = Math.max(1, Math.trunc(Number(connector.width) || 1))
  const depth = Math.max(1, Math.trunc(Number(connector.depth) || 1))
  return rangesIntersect(x, x + width - 1, area.minX, area.maxX)
    && rangesIntersect(z, z + depth - 1, area.minZ, area.maxZ)
}

function sameLevel(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.001
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
    const contained = getRoomFootprintCells(room).every(cell => (
      cell.x >= area.minX && cell.x <= area.maxX && cell.z >= area.minZ && cell.z <= area.maxZ
    ))
    if (matchesLevel && contained) {
      delete rooms[id]
      changed = true
    }
  }

  for (const [id, floor] of Object.entries(next.floors)) {
    const parsed = parseFloorKey(id, floor)
    if (
      parsed.x >= area.minX
      && parsed.x <= area.maxX
      && parsed.z >= area.minZ
      && parsed.z <= area.maxZ
      && sameLevel(parsed.y, targetY)
    ) {
      delete floors[id]
      changed = true
    }
  }

  for (const [id, wall] of Object.entries(next.walls)) {
    if (sameLevel(wall?.y, targetY) && wallIntersectsCellArea(wall, area)) {
      delete walls[id]
      changed = true
    }
  }

  for (const [id, ceiling] of Object.entries(next.ceilings)) {
    const parsed = parseCeilingKey(id, ceiling)
    const matchesLevel = sameLevel(parsed.baseY, targetY) || sameLevel(parsed.y, targetY)
    if (
      parsed.x >= area.minX
      && parsed.x <= area.maxX
      && parsed.z >= area.minZ
      && parsed.z <= area.maxZ
      && matchesLevel
    ) {
      delete ceilings[id]
      changed = true
    }
  }

  for (const [id, stair] of Object.entries(next.stairs)) {
    const sameStartOrEnd = sameLevel(stair?.y, targetY) || sameLevel(stair?.topY, targetY)
    if (sameStartOrEnd && cellAreaIntersectsBounds(stair, area)) {
      delete stairs[id]
      changed = true
    }
  }

  for (const [id, connector] of Object.entries(next.connectors)) {
    const wallOpeningLevelMatches = ['door', 'window', 'screen-window'].includes(connector?.type)
      && Number.isFinite(Number(connector?.level))
      && sameLevel(levelToY(connector.level), targetY)
    const sameStartOrEnd = wallOpeningLevelMatches
      || (Number.isFinite(Number(connector?.y)) && sameLevel(connector.y, targetY))
      || (Number.isFinite(Number(connector?.fromLevel)) && sameLevel(levelToY(connector.fromLevel), targetY))
      || (Number.isFinite(Number(connector?.toLevel)) && sameLevel(levelToY(connector.toLevel), targetY))
    if (sameStartOrEnd && connectorIntersectsCellArea(connector, area)) {
      delete connectors[id]
      changed = true
    }
  }

  return changed ? { ...next, rooms, floors, walls, ceilings, stairs, connectors } : surfaceData
}

function cellKey(x, z) {
  return `${x}:${z}`
}

function surfaceBlocksWater(surface) {
  if (!surface) return false
  if (surface.blocksWater !== undefined) return !!surface.blocksWater
  return surface.barrierType !== 'grate'
}

function ensureWaterLevel(levels, baseY) {
  const key = formatLevel(baseY)
  if (!levels.has(key)) {
    levels.set(key, {
      baseY,
      cells: new Map(),
      candidates: new Map(),
      topY: baseY + DEFAULT_CEILING_HEIGHT,
    })
  }
  return levels.get(key)
}

function includeWaterCell(levels, baseY, x, z, topY = null) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return
  const level = ensureWaterLevel(levels, baseY)
  level.cells.set(cellKey(x, z), { x, z })
  if (Number.isFinite(topY)) level.topY = Math.max(level.topY, topY)
}

function findCeilingForFloor(surface, x, z, baseY) {
  let best = null
  const consider = (candidate) => {
    if (!candidate || candidate.y <= baseY) return
    if (!best || candidate.y < best.y) best = candidate
  }

  for (const [id, ceiling] of Object.entries(surface.ceilings)) {
    if (!surfaceBlocksWater(ceiling)) continue
    const parsed = parseCeilingKey(id, ceiling)
    if (parsed.x !== x || parsed.z !== z || !sameLevel(parsed.baseY, baseY)) continue
    consider({
      ...parsed,
      y: parsed.y - getCeilingThickness(ceiling) / 2,
      ceiling,
      source: 'ceiling',
    })
  }

  for (const [id, floor] of Object.entries(surface.floors)) {
    if (!surfaceBlocksWater(floor)) continue
    const parsed = parseFloorKey(id, floor)
    if (parsed.x !== x || parsed.z !== z || parsed.y <= baseY) continue
    consider({
      x: parsed.x,
      z: parsed.z,
      baseY,
      y: parsed.y - getFloorThickness(floor) / 2,
      floor,
      source: 'upper-floor',
    })
  }

  return best
}

function wallIntervalCovers(start, end, min, max) {
  const low = Math.min(start, end)
  const high = Math.max(start, end)
  const epsilon = 0.01
  return low <= min + epsilon && high >= max - epsilon
}

function segmentsIntersect2d(a, b, c, d) {
  const epsilon = 0.01
  if (Math.max(a.x, b.x) + epsilon < Math.min(c.x, d.x)
    || Math.max(c.x, d.x) + epsilon < Math.min(a.x, b.x)
    || Math.max(a.z, b.z) + epsilon < Math.min(c.z, d.z)
    || Math.max(c.z, d.z) + epsilon < Math.min(a.z, b.z)) return false

  const cross = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x)
  const abC = cross(a, b, c)
  const abD = cross(a, b, d)
  const cdA = cross(c, d, a)
  const cdB = cross(c, d, b)
  return abC * abD <= epsilon && cdA * cdB <= epsilon
}

function wallMatchesWaterEdge(wall, x, z, direction) {
  if (!surfaceBlocksWater(wall)) return false

  const fine = SURFACE_FINE
  const minX = x * fine
  const maxX = (x + 1) * fine
  const minZ = z * fine
  const maxZ = (z + 1) * fine

  if (wall.axis === 'segment') {
    const edge = direction === 'north' || direction === 'south'
      ? [
          { x: minX, z: (direction === 'north' ? z : z + 1) * fine },
          { x: maxX, z: (direction === 'north' ? z : z + 1) * fine },
        ]
      : [
          { x: (direction === 'west' ? x : x + 1) * fine, z: minZ },
          { x: (direction === 'west' ? x : x + 1) * fine, z: maxZ },
        ]
    return segmentsIntersect2d(
      { x: Number(wall.x0), z: Number(wall.z0) },
      { x: Number(wall.x1), z: Number(wall.z1) },
      edge[0],
      edge[1],
    )
  }

  if (direction === 'north' || direction === 'south') {
    if (wall.axis !== 'x') return false
    const edgeZ = (direction === 'north' ? z : z + 1) * fine
    return Math.abs(Number(wall.z0) - edgeZ) < 0.01
      && wallIntervalCovers(Number(wall.x0), Number(wall.x1), minX, maxX)
  }

  if (wall.axis !== 'z') return false
  const edgeX = (direction === 'west' ? x : x + 1) * fine
  return Math.abs(Number(wall.x0) - edgeX) < 0.01
    && wallIntervalCovers(Number(wall.z0), Number(wall.z1), minZ, maxZ)
}

function edgeBlocksWater(surface, x, z, direction, baseY, topY) {
  const intervals = Object.values(surface.walls)
    .filter(wall => wallMatchesWaterEdge(wall, x, z, direction))
    .map(wall => {
      const bottom = getWallBaseY(wall)
      return {
        bottom,
        top: bottom + Math.max(0.5, Number(wall?.height) || DEFAULT_CEILING_HEIGHT),
      }
    })
    .sort((a, b) => a.bottom - b.bottom)

  let coveredTo = baseY
  const epsilon = 0.05
  for (const interval of intervals) {
    if (interval.top <= coveredTo + epsilon) continue
    if (interval.bottom > coveredTo + epsilon) return false
    coveredTo = Math.max(coveredTo, interval.top)
    if (coveredTo >= topY - epsilon) return true
  }
  return false
}

function includeWallBounds(levels, wall) {
  const bounds = getWallFineBounds(wall)
  if (!bounds) return
  const baseY = getWallBaseY(wall)
  const topY = baseY + Math.max(0.5, Number(wall?.height) || DEFAULT_CEILING_HEIGHT)
  const fine = SURFACE_FINE
  const minX = Math.floor(bounds.minX / fine)
  const maxX = Math.ceil(bounds.maxX / fine) - 1
  const minZ = Math.floor(bounds.minZ / fine)
  const maxZ = Math.ceil(bounds.maxZ / fine) - 1
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      includeWaterCell(levels, baseY, x, z, topY)
    }
  }
}

export function computeSurfaceWaterCells(data, margin = 2) {
  const surface = expandRoomsToSurface(data)
  const levels = new Map()

  for (const [id, floor] of Object.entries(surface.floors)) {
    const parsed = parseFloorKey(id, floor)
    includeWaterCell(levels, parsed.y, parsed.x, parsed.z)
    if (!surfaceBlocksWater(floor)) continue
    const ceiling = findCeilingForFloor(surface, parsed.x, parsed.z, parsed.y)
    if (!ceiling) continue
    const level = ensureWaterLevel(levels, parsed.y)
    level.candidates.set(cellKey(parsed.x, parsed.z), {
      x: parsed.x,
      z: parsed.z,
      baseY: parsed.y,
      ceilingY: ceiling.y,
    })
    level.topY = Math.max(level.topY, ceiling.y)
  }

  for (const [id, ceiling] of Object.entries(surface.ceilings)) {
    const parsed = parseCeilingKey(id, ceiling)
    includeWaterCell(levels, parsed.baseY, parsed.x, parsed.z, parsed.y)
  }

  for (const wall of Object.values(surface.walls)) {
    includeWallBounds(levels, wall)
  }

  for (const stair of Object.values(surface.stairs)) {
    const baseY = Number(stair?.y) || 0
    const topY = Number(stair?.topY) || baseY + DEFAULT_CEILING_HEIGHT
    for (let x = Number(stair.minX) || 0; x <= (Number(stair.maxX) || 0); x += 1) {
      for (let z = Number(stair.minZ) || 0; z <= (Number(stair.maxZ) || 0); z += 1) {
        includeWaterCell(levels, baseY, x, z, topY)
      }
    }
  }

  // La nappe extérieure représente le sommet physique de toute la carte.
  // Les coordonnées de plafond sont au centre de la dalle : il faut donc
  // inclure sa demi-épaisseur pour ne pas dessiner l'eau à l'intérieur du toit.
  const mapTopY = Math.max(
    ...Object.entries(surface.floors).map(([id, floor]) => (
      parseFloorKey(id, floor).y + getFloorThickness(floor) / 2
    )),
    ...Object.entries(surface.ceilings).map(([id, ceiling]) => (
      parseCeilingKey(id, ceiling).y + getCeilingThickness(ceiling) / 2
    )),
    ...Object.values(surface.walls).map(wall => (
      getWallBaseY(wall) + Math.max(0.5, Number(wall?.height) || DEFAULT_CEILING_HEIGHT)
    )),
    ...Object.values(surface.stairs).map(stair => (
      Number(stair?.topY) || (Number(stair?.y) || 0) + DEFAULT_CEILING_HEIGHT
    )),
    0,
  )

  const dryCellKeys = new Set()
  const waterCellsByPosition = new Map()

  for (const [levelId, level] of levels) {
    const sourceCells = [...level.cells.values()]
    if (sourceCells.length === 0) continue

    const minX = Math.min(...sourceCells.map(cell => cell.x)) - margin
    const maxX = Math.max(...sourceCells.map(cell => cell.x)) + margin
    const minZ = Math.min(...sourceCells.map(cell => cell.z)) - margin
    const maxZ = Math.max(...sourceCells.map(cell => cell.z)) + margin
    const inBounds = (x, z) => x >= minX && x <= maxX && z >= minZ && z <= maxZ
    const visited = new Set()
    const queue = []

    const enqueue = (x, z) => {
      if (!inBounds(x, z)) return
      const key = cellKey(x, z)
      if (visited.has(key)) return
      visited.add(key)
      queue.push({ x, z })
    }

    for (let x = minX; x <= maxX; x += 1) {
      enqueue(x, minZ)
      enqueue(x, maxZ)
    }
    for (let z = minZ; z <= maxZ; z += 1) {
      enqueue(minX, z)
      enqueue(maxX, z)
    }

    const neighbors = [
      { dx: 0, dz: -1, direction: 'north' },
      { dx: 0, dz: 1, direction: 'south' },
      { dx: -1, dz: 0, direction: 'west' },
      { dx: 1, dz: 0, direction: 'east' },
    ]

    while (queue.length > 0) {
      const cell = queue.shift()
      for (const neighbor of neighbors) {
        const nx = cell.x + neighbor.dx
        const nz = cell.z + neighbor.dz
        if (!inBounds(nx, nz)) continue
        const here = level.candidates.get(cellKey(cell.x, cell.z))
        const there = level.candidates.get(cellKey(nx, nz))
        const topY = Math.max(here?.ceilingY || level.topY, there?.ceilingY || level.topY)
        if (edgeBlocksWater(surface, cell.x, cell.z, neighbor.direction, level.baseY, topY)) continue
        enqueue(nx, nz)
      }
    }

    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const key = cellKey(x, z)
        const candidate = level.candidates.get(key)
        if (candidate && !visited.has(key)) {
          dryCellKeys.add(`${levelId}:${key}`)
          continue
        }
        const waterKey = cellKey(x, z)
        const existing = waterCellsByPosition.get(waterKey)
        waterCellsByPosition.set(waterKey, {
          x,
          z,
          baseY: Math.min(existing?.baseY ?? level.baseY, level.baseY),
          topY: mapTopY,
        })
      }
    }
  }

  return { dryCellKeys, waterCells: [...waterCellsByPosition.values()] }
}
