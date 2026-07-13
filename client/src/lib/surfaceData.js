import {
  DEFAULT_SURFACE_MATERIAL_PRESET,
  makeProceduralMaterialDescriptor,
} from './proceduralMaterials.js'

export const SURFACE_FINE = 4
export const STORY_HEIGHT = 2.5
const STATION_USED_PACK_ID = '6f3916a6-7c7b-45f7-a020-7d63b7a74176'
const STATION_USED_SPECIAL_RATE = 12
const DEFAULT_FLOOR_THICKNESS = 0.25
const DEFAULT_CEILING_HEIGHT = 2.5
const STAIR_STEPS_PER_CELL = 4
export const DEFAULT_SURFACE_DATA = {
  version: 5,
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
  const normalizedFace = face === 'wallFront'
    ? 'wallInterior'
    : face === 'wallBack'
      ? 'wallExterior'
      : face
  const preset = tool?.materialProfiles?.[normalizedFace] || tool?.materialProfiles?.[face]
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
  return {
    version: Math.max(5, data.version || 2),
    fine: data.fine || SURFACE_FINE,
    storyHeight: data.storyHeight || STORY_HEIGHT,
    rooms: data.rooms && typeof data.rooms === 'object' && !Array.isArray(data.rooms) ? data.rooms : {},
    floors: data.floors && typeof data.floors === 'object' && !Array.isArray(data.floors) ? data.floors : {},
    walls: data.walls && typeof data.walls === 'object' && !Array.isArray(data.walls) ? data.walls : {},
    ceilings: data.ceilings && typeof data.ceilings === 'object' && !Array.isArray(data.ceilings) ? data.ceilings : {},
    stairs: data.stairs && typeof data.stairs === 'object' && !Array.isArray(data.stairs) ? data.stairs : {},
    connectors: data.connectors && typeof data.connectors === 'object' && !Array.isArray(data.connectors) ? data.connectors : {},
  }
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
    if (room?.floorTopTex) ids.add(room.floorTopTex)
    if (room?.floorBottomTex) ids.add(room.floorBottomTex)
    if (room?.ceilingTopTex) ids.add(room.ceilingTopTex)
    if (room?.ceilingBottomTex) ids.add(room.ceilingBottomTex)
    if (room?.wallInteriorTex) ids.add(room.wallInteriorTex)
    if (room?.wallExteriorTex) ids.add(room.wallExteriorTex)
    if (room?.wallFrontTex) ids.add(room.wallFrontTex)
    if (room?.wallBackTex) ids.add(room.wallBackTex)
    if (room?.wallTopTex) ids.add(room.wallTopTex)
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
        tool: toolForMaterialFace(tool, 'top'),
        packId: tool?.floorPackId,
        textureId: tool?.floorTexId,
        fallbackTexId: activeMaterial?.texId,
        availableBlocks,
        seed: `floor:${x}:${z}:${formatLevel(y)}`,
      })
      const bottom = materialOrTextureForTool({
        tool: toolForMaterialFace(tool, 'bottom'),
        packId: tool?.ceilingPackId || tool?.floorPackId,
        textureId: tool?.ceilingTexId || tool?.floorTexId,
        fallbackTexId: top.tex || activeMaterial?.texId,
        availableBlocks,
        seed: `floor-bottom:${x}:${z}:${formatLevel(y)}`,
      })
      if ((!top.tex && !top.material) || (!bottom.tex && !bottom.material)) continue
      floors[floorKey(x, z, y)] = {
        ...(top.tex ? { topTex: top.tex } : {}),
        ...(bottom.tex ? { bottomTex: bottom.tex } : {}),
        ...(top.material ? { topMaterial: top.material } : {}),
        ...(bottom.material ? { bottomMaterial: bottom.material } : {}),
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
  for (let x = area.minX; x <= area.maxX; x += 1) {
    for (let z = area.minZ; z <= area.maxZ; z += 1) {
      const key = floorKey(x, z, y)
      if (!floors[key]) continue
      floors[key] = {
        ...floors[key],
        kind: 'bridge',
        structuralKind: 'bridge',
        runtimeSupport: true,
        movementMultiplier: getToolMovementMultiplier(tool),
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
  const front = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'wallFront'),
    packId: tool?.wallFrontPackId,
    textureId: tool?.wallFrontTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:front`,
  })
  const back = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'wallBack'),
    packId: tool?.wallBackPackId || tool?.wallFrontPackId,
    textureId: tool?.wallBackTexId,
    fallbackTexId: front.tex || activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:back`,
  })
  if ((!front.tex && !front.material) || (!back.tex && !back.material)) return null

  return {
    ...wall,
    id,
    y,
    supportThickness: getToolFloorThickness(tool),
    ...surfaceBlockingForTool(tool),
    ...(front.tex ? { frontTex: front.tex } : {}),
    ...(back.tex ? { backTex: back.tex } : {}),
    ...(front.material ? { frontMaterial: front.material } : {}),
    ...(back.material ? { backMaterial: back.material } : {}),
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
    if (!roomIncludesCell(room, cell.x, cell.z)) continue
    const footprint = getRoomFootprintCells(room)

    const roomLevel = yToLevel(getRoomBaseY(room))
    const heightLevels = getRoomHeightLevels(room)
    if (targetLevel !== null && (targetLevel < roomLevel || targetLevel >= roomLevel + heightLevels)) continue

    matches.push({
      id,
      room: { id, ...room },
      area: footprint.length,
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
    const heightLevels = getRoomHeightLevels(room)
    if (targetLevel !== null && (targetLevel < roomLevel || targetLevel >= roomLevel + heightLevels)) continue

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
  return Math.max(1, Math.min(12, Number.parseInt(room?.heightLevels, 10) || Math.round((Number(room?.height) || STORY_HEIGHT) / STORY_HEIGHT) || 1))
}

export function isWorldPointVisibleAtLevel(data, displayLevel, x, z, y) {
  if (displayLevel === null || displayLevel === undefined) return true

  const itemLevel = yToLevel(y)
  if (itemLevel === displayLevel) return true
  if (itemLevel > displayLevel) return false

  const worldX = Number(x)
  const worldZ = Number(z)
  if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) return false

  const rooms = data?.rooms && typeof data.rooms === 'object' && !Array.isArray(data.rooms)
    ? data.rooms
    : {}
  return Object.values(rooms).some(room => {
    const heightLevels = getRoomHeightLevels(room)
    if (heightLevels < 2) return false

    const baseLevel = yToLevel(getRoomBaseY(room))
    const topLevel = baseLevel + heightLevels - 1
    if (itemLevel < baseLevel || itemLevel > displayLevel || displayLevel > topLevel) return false

    return roomIncludesCell(room, Math.floor(worldX), Math.floor(worldZ))
  })
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
  return room?.wallInteriorTex || room?.wallFrontTex || null
}

function roomWallExteriorTex(room) {
  return room?.wallExteriorTex || room?.wallBackTex || roomWallInteriorTex(room)
}

function roomWallInteriorMaterial(room) {
  return room?.wallInteriorMaterial || room?.wallFrontMaterial || null
}

function roomWallExteriorMaterial(room) {
  return room?.wallExteriorMaterial || room?.wallBackMaterial || roomWallInteriorMaterial(room)
}

function roomMaterialProfilesForTool(tool) {
  const profiles = tool?.materialProfiles || {}
  return {
    top: profiles.top || tool?.materialPreset,
    bottom: profiles.bottom || profiles.top || tool?.materialPreset,
    wallInterior: profiles.wallInterior || profiles.wallFront || profiles.top || tool?.materialPreset,
    wallExterior: profiles.wallExterior || profiles.wallBack || profiles.wallInterior || profiles.wallFront || profiles.top || tool?.materialPreset,
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
  const wallExterior = roomWallExteriorMaterial(room)
  const hasProceduralMaterial = !!(
    room.floorTopMaterial
    || room.floorBottomMaterial
    || room.ceilingTopMaterial
    || room.ceilingBottomMaterial
    || wallInterior
    || wallExterior
  )
  return {
    selectedRoomId: room.id,
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
    materialFace: 'top',
    floorPackId: null,
    floorBottomPackId: null,
    ceilingPackId: null,
    ceilingBottomPackId: null,
    wallPackId: null,
    wallInteriorPackId: null,
    wallExteriorPackId: null,
    wallFrontPackId: null,
    wallBackPackId: null,
    floorTexId: room.floorTopTex || null,
    floorBottomTexId: room.floorBottomTex || null,
    ceilingTexId: room.ceilingTopTex || null,
    ceilingBottomTexId: room.ceilingBottomTex || null,
    wallInteriorTexId: roomWallInteriorTex(room),
    wallExteriorTexId: roomWallExteriorTex(room),
    wallFrontTexId: roomWallInteriorTex(room),
    wallBackTexId: roomWallExteriorTex(room),
    materialProfiles: {
      top: profileOrDefault(room.floorTopMaterial),
      bottom: profileOrDefault(room.floorBottomMaterial, room.floorBottomMaterial ? {} : { paint: '#6b7280' }),
      wallInterior: profileOrDefault(wallInterior),
      wallExterior: profileOrDefault(wallExterior),
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
  const floorTop = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'top'),
    packId: tool?.floorPackId,
    textureId: tool?.floorTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:floor:top`,
  })
  const floorBottom = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'bottom'),
    packId: tool?.floorBottomPackId || tool?.floorPackId,
    textureId: tool?.floorBottomTexId || tool?.floorTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:floor:bottom`,
  })
  const ceilingTop = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'top'),
    packId: tool?.ceilingPackId || tool?.floorPackId,
    textureId: tool?.ceilingTexId || tool?.floorTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:ceiling:top`,
  })
  const ceilingBottom = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'bottom'),
    packId: tool?.ceilingBottomPackId || tool?.ceilingPackId || tool?.floorPackId,
    textureId: tool?.ceilingBottomTexId || tool?.ceilingTexId || tool?.floorTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:ceiling:bottom`,
  })
  const wallInterior = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'wallInterior'),
    packId: tool?.wallInteriorPackId || tool?.wallFrontPackId || tool?.wallPackId,
    textureId: tool?.wallInteriorTexId || tool?.wallFrontTexId || tool?.wallTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:wall:interior`,
  })
  const wallExterior = materialOrTextureForTool({
    tool: toolForMaterialFace(tool, 'wallExterior'),
    packId: tool?.wallExteriorPackId || tool?.wallBackPackId || tool?.wallInteriorPackId || tool?.wallFrontPackId || tool?.wallPackId,
    textureId: tool?.wallExteriorTexId || tool?.wallBackTexId || tool?.wallInteriorTexId || tool?.wallFrontTexId || tool?.wallTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:wall:exterior`,
  })

  return {
    id,
    type: 'room',
    shape: 'footprint',
    theme: tool?.roomTheme || 'custom',
    seed: hashString(`${id}:${tool?.materialProfiles?.top?.seed || ''}`),
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
    floorTopTex: floorTop.tex,
    floorBottomTex: floorBottom.tex,
    ceilingTopTex: ceilingTop.tex,
    ceilingBottomTex: ceilingBottom.tex,
    wallInteriorTex: wallInterior.tex,
    wallExteriorTex: wallExterior.tex,
    wallFrontTex: wallInterior.tex,
    wallBackTex: wallExterior.tex,
    floorTopMaterial: floorTop.material,
    floorBottomMaterial: floorBottom.material,
    ceilingTopMaterial: ceilingTop.material,
    ceilingBottomMaterial: ceilingBottom.material,
    wallInteriorMaterial: wallInterior.material,
    wallExteriorMaterial: wallExterior.material,
    wallFrontMaterial: wallInterior.material,
    wallBackMaterial: wallExterior.material,
  }
}

export function roomWallSegments(room) {
  return roomsWallSegments(room ? { [room.id || 'room']: room } : {})
}

function setWallFace(wall, face, source) {
  if (!wall || !source) return
  if (!source.tex && !source.material) return
  const rolePriority = source.role === 'interior' ? 2 : source.role === 'exterior' ? 1 : 0
  if (face === 'front') {
    if ((wall._frontRolePriority || 0) > rolePriority) return
    wall.frontTex = source.tex
    wall.frontMaterial = source.material
    wall.frontRole = source.role || null
    wall._frontRolePriority = rolePriority
  } else {
    if ((wall._backRolePriority || 0) > rolePriority) return
    wall.backTex = source.tex
    wall.backMaterial = source.material
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
      frontTex: null,
      backTex: null,
      topTex: roomWallInteriorTex(data.room) || roomWallExteriorTex(data.room),
      frontMaterial: null,
      backMaterial: null,
      material: roomWallInteriorMaterial(data.room) || roomWallExteriorMaterial(data.room),
      roomIds: [],
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
  delete wall._frontRolePriority
  delete wall._backRolePriority
  return wall
}

export function roomsWallSegments(rooms) {
  const panels = new Map()

  for (const [roomId, rawRoom] of Object.entries(rooms || {})) {
    const room = { id: roomId, ...rawRoom }
    if (!room || room.wallEnabled === false) continue

    const footprint = getRoomFootprintCells(room)
    const footprintKeys = new Set(footprint.map(cell => roomCellKey(cell.x, cell.z)))
    const fine = SURFACE_FINE
    const heightLevels = getRoomHeightLevels(room)
    const baseY = getRoomBaseY(room)
    const thickness = Math.max(1, Number(room.wallThickness) || 1)
    const interior = {
      role: 'interior',
      tex: roomWallInteriorTex(room),
      material: roomWallInteriorMaterial(room),
    }
    const exterior = {
      role: 'exterior',
      tex: roomWallExteriorTex(room),
      material: roomWallExteriorMaterial(room),
    }

    const addPanel = ({ side, axis, x0, x1, z0, z1, frontSource, backSource, y }) => {
      const key = `room-wall:${axis}:${x0}:${z0}:${x1}:${z1}:${formatLevel(y)}`
      const wall = ensureRoomWallPanel(panels, key, {
        room,
        axis,
        y,
        thickness,
        x0,
        x1,
        z0,
        z1,
      })
      setWallFace(wall, 'front', frontSource)
      setWallFace(wall, 'back', backSource)
      wall.side = wall.side || side
    }

    for (let offset = 0; offset < heightLevels; offset += 1) {
      const y = baseY + offset * STORY_HEIGHT

      for (const { x, z } of footprint) {
        const x0 = x * fine
        const x1 = (x + 1) * fine
        const z0 = z * fine
        const z1 = (z + 1) * fine

        if (!footprintKeys.has(roomCellKey(x, z - 1))) {
          addPanel({
            side: 'north', axis: 'x', x0, x1, z0, z1: z0,
            frontSource: interior, backSource: exterior, y,
          })
        }
        if (!footprintKeys.has(roomCellKey(x, z + 1))) {
          addPanel({
            side: 'south', axis: 'x', x0, x1, z0: z1, z1,
            frontSource: exterior, backSource: interior, y,
          })
        }
        if (!footprintKeys.has(roomCellKey(x - 1, z))) {
          addPanel({
            side: 'west', axis: 'z', x0, x1: x0, z0, z1,
            frontSource: interior, backSource: exterior, y,
          })
        }
        if (!footprintKeys.has(roomCellKey(x + 1, z))) {
          addPanel({
            side: 'east', axis: 'z', x0: x1, x1, z0, z1,
            frontSource: exterior, backSource: interior, y,
          })
        }
      }
    }
  }

  return [...panels.values()].map(completeRoomWallPanel)
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

  const epsilon = SURFACE_FINE * 0.35
  if (panel.axis === 'x') {
    const min = Math.min(Number(panel.x0), Number(panel.x1))
    const max = Math.max(Number(panel.x0), Number(panel.x1))
    if (fx < min - epsilon || fx > max + epsilon) return null
    return Math.abs(fz - Number(panel.z0))
  }

  const min = Math.min(Number(panel.z0), Number(panel.z1))
  const max = Math.max(Number(panel.z0), Number(panel.z1))
  if (fz < min - epsilon || fz > max + epsilon) return null
  return Math.abs(fx - Number(panel.x0))
}

export function makeDoorConnectorFromWallPoint(surfaceData, wallPoint, tool = {}) {
  if (!wallPoint) return null
  const surface = normalizeSurfaceData(surfaceData)
  const level = getToolLevel(tool)
  const y = levelToY(level)
  const selectedRoomId = tool?.selectedRoomId || null
  let best = null

  for (const panel of roomsWallSegments(surface.rooms)) {
    if (!sameLevel(panel.y, y)) continue
    if (selectedRoomId && !panel.roomIds?.includes(selectedRoomId)) continue
    const distance = wallPointDistanceToPanel(wallPoint, panel)
    if (distance === null || distance > SURFACE_FINE * 0.5) continue
    if (best && distance >= best.distance) continue
    best = { panel, distance }
  }

  if (!best?.panel) return null
  const panel = best.panel
  const state = tool?.connectorState || 'closed'
  const modelGeometry = connectorModelGeometryFromTool(tool)
  const modelWidth = connectorModelOuterWidthFromTool(tool, modelGeometry)
  const modelDepth = Math.max(0.05, Number(modelGeometry.depth) || 0.25)
  const modelHeight = Math.max(0.5, Number(modelGeometry.height) || Math.min(2, STORY_HEIGHT * 0.9))
  const doorLengthFine = modelWidth * SURFACE_FINE
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
    version: 5,
    connectors: {
      ...next.connectors,
      [connector.id]: connector,
    },
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
    version: 5,
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
    version: 5,
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
    const footprint = getRoomFootprintCells(room)
    const baseY = getRoomBaseY(room)
    const topY = getRoomTopY(room)
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
              topTex: room.floorTopTex,
              bottomTex: room.floorBottomTex,
              topMaterial: room.floorTopMaterial,
              bottomMaterial: room.floorBottomMaterial,
              ...blocking,
            }
          }
      }
    }

    if (room.ceilingEnabled !== false) {
      for (const { x, z } of footprint) {
          const id = ceilingKey(x, z, baseY, topY)
          if (!ceilings[id]) {
            ceilings[id] = {
              baseY,
              y: topY,
              thickness: getRoomCeilingThickness(room),
              topTex: room.ceilingTopTex,
              bottomTex: room.ceilingBottomTex,
              material: room.ceilingBottomMaterial || room.ceilingTopMaterial,
              topMaterial: room.ceilingTopMaterial,
              bottomMaterial: room.ceilingBottomMaterial,
              ...blocking,
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
  if (!keepWorldId) delete next.worldId
  return next
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

  rooms[room.id] = room
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
    version: 5,
    rooms,
    connectors,
  }
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
  const floorTop = materialOrTextureForTool({
    tool: toolForMaterialFace(toolWithProfiles, 'top'),
    packId: tool?.floorPackId,
    textureId: tool?.floorTexId || room.floorTopTex,
    fallbackTexId: room.floorTopTex || activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:floor:top`,
  })
  const floorBottom = materialOrTextureForTool({
    tool: toolForMaterialFace(toolWithProfiles, 'bottom'),
    packId: tool?.floorBottomPackId || tool?.floorPackId,
    textureId: tool?.floorBottomTexId || tool?.floorTexId || room.floorBottomTex,
    fallbackTexId: room.floorBottomTex || room.floorTopTex || activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:floor:bottom`,
  })
  const ceilingTop = materialOrTextureForTool({
    tool: toolForMaterialFace(toolWithProfiles, 'top'),
    packId: tool?.ceilingPackId || tool?.floorPackId,
    textureId: tool?.ceilingTexId || tool?.floorTexId || room.ceilingTopTex,
    fallbackTexId: room.ceilingTopTex || room.floorTopTex || activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:ceiling:top`,
  })
  const ceilingBottom = materialOrTextureForTool({
    tool: toolForMaterialFace(toolWithProfiles, 'bottom'),
    packId: tool?.ceilingBottomPackId || tool?.ceilingPackId || tool?.floorPackId,
    textureId: tool?.ceilingBottomTexId || tool?.ceilingTexId || tool?.floorTexId || room.ceilingBottomTex,
    fallbackTexId: room.ceilingBottomTex || room.floorBottomTex || activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:ceiling:bottom`,
  })
  const wallInterior = materialOrTextureForTool({
    tool: toolForMaterialFace(toolWithProfiles, 'wallInterior'),
    packId: tool?.wallInteriorPackId || tool?.wallFrontPackId || tool?.wallPackId,
    textureId: tool?.wallInteriorTexId || tool?.wallFrontTexId || roomWallInteriorTex(room),
    fallbackTexId: roomWallInteriorTex(room) || activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:wall:interior`,
  })
  const wallExterior = materialOrTextureForTool({
    tool: toolForMaterialFace(toolWithProfiles, 'wallExterior'),
    packId: tool?.wallExteriorPackId || tool?.wallBackPackId || tool?.wallInteriorPackId || tool?.wallFrontPackId || tool?.wallPackId,
    textureId: tool?.wallExteriorTexId || tool?.wallBackTexId || tool?.wallInteriorTexId || tool?.wallFrontTexId || roomWallExteriorTex(room),
    fallbackTexId: roomWallExteriorTex(room) || roomWallInteriorTex(room) || activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:wall:exterior`,
  })

  const heightLevels = getToolRoomHeightLevels(tool)
  const blocking = surfaceBlockingForTool(tool)
  const updated = {
    ...room,
    heightLevels,
    height: heightLevels * STORY_HEIGHT,
    floorThickness: getToolFloorThickness(tool),
    ceilingThickness: getToolCeilingThickness(tool),
    wallThickness: getToolWallThicknessFine(tool),
    movementMultiplier: getToolMovementMultiplier(tool),
    ...blocking,
    floorTopTex: floorTop.tex,
    floorBottomTex: floorBottom.tex,
    ceilingTopTex: ceilingTop.tex,
    ceilingBottomTex: ceilingBottom.tex,
    wallInteriorTex: wallInterior.tex,
    wallExteriorTex: wallExterior.tex,
    wallFrontTex: wallInterior.tex,
    wallBackTex: wallExterior.tex,
    floorTopMaterial: floorTop.material,
    floorBottomMaterial: floorBottom.material,
    ceilingTopMaterial: ceilingTop.material,
    ceilingBottomMaterial: ceilingBottom.material,
    wallInteriorMaterial: wallInterior.material,
    wallExteriorMaterial: wallExterior.material,
    wallFrontMaterial: wallInterior.material,
    wallBackMaterial: wallExterior.material,
  }

  if (JSON.stringify(updated) === JSON.stringify(room)) return surfaceData

  return {
    ...next,
    version: 5,
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
  if (connector.type === 'door') {
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
    const sameStartOrEnd = sameLevel(connector?.y, targetY)
      || sameLevel(levelToY(connector?.fromLevel), targetY)
      || sameLevel(levelToY(connector?.toLevel), targetY)
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

  // La nappe extérieure représente la surface de l'eau autour de toute la
  // carte, pas le plafond de chaque étage pris séparément.
  const mapTopY = Math.max(
    ...[...levels.values()].map(level => level.topY),
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
