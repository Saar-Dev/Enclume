import {
  DEFAULT_SURFACE_MATERIAL_PRESET,
  makeProceduralMaterialDescriptor,
} from './proceduralMaterials.js'

export const SURFACE_FINE = 4
const STATION_USED_PACK_ID = '6f3916a6-7c7b-45f7-a020-7d63b7a74176'
const STATION_USED_SPECIAL_RATE = 12
const DEFAULT_FLOOR_THICKNESS = 0.25
const DEFAULT_CEILING_HEIGHT = 2.5
const STAIR_STEPS_PER_CELL = 4
export const DEFAULT_SURFACE_DATA = {
  version: 2,
  fine: SURFACE_FINE,
  floors: {},
  walls: {},
  ceilings: {},
  stairs: {},
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
  return clampNumber(tool?.elevation, -8, 16, 0)
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
  const bounds = getWallFineBounds(wall)
  if (!bounds) return null

  const fine = SURFACE_FINE
  const height = Math.max(0.5, Number(wall.height) || 2.5)
  const baseY = getWallBaseY(wall)

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
  const variantSeed = tool?.autoVariants === false ? 'fixed' : seed
  return makeProceduralMaterialDescriptor({
    ...preset,
    seed: `${preset.seed || DEFAULT_SURFACE_MATERIAL_PRESET.seed}:${variantSeed}`,
  })
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
    version: data.version || 2,
    fine: data.fine || SURFACE_FINE,
    floors: data.floors && typeof data.floors === 'object' && !Array.isArray(data.floors) ? data.floors : {},
    walls: data.walls && typeof data.walls === 'object' && !Array.isArray(data.walls) ? data.walls : {},
    ceilings: data.ceilings && typeof data.ceilings === 'object' && !Array.isArray(data.ceilings) ? data.ceilings : {},
    stairs: data.stairs && typeof data.stairs === 'object' && !Array.isArray(data.stairs) ? data.stairs : {},
  }
}

export function hasSurfaceContent(data) {
  const surface = normalizeSurfaceData(data)
  return Object.keys(surface.floors).length > 0
    || Object.keys(surface.walls).length > 0
    || Object.keys(surface.ceilings).length > 0
    || Object.keys(surface.stairs).length > 0
}

export function surfaceTextureIds(data) {
  const surface = normalizeSurfaceData(data)
  const ids = new Set()

  for (const floor of Object.values(surface.floors)) {
    if (floor?.tex) ids.add(floor.tex)
  }
  for (const wall of Object.values(surface.walls)) {
    if (wall?.frontTex) ids.add(wall.frontTex)
    if (wall?.backTex) ids.add(wall.backTex)
    if (wall?.topTex) ids.add(wall.topTex)
  }
  for (const ceiling of Object.values(surface.ceilings)) {
    if (ceiling?.tex) ids.add(ceiling.tex)
  }
  for (const stair of Object.values(surface.stairs)) {
    if (stair?.tex) ids.add(stair.tex)
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
      const { tex, material } = materialOrTextureForTool({
        tool,
        packId: tool?.floorPackId,
        textureId: tool?.floorTexId,
        fallbackTexId: activeMaterial?.texId,
        availableBlocks,
        seed: `floor:${x}:${z}:${formatLevel(y)}`,
      })
      if (!tex && !material) continue
      floors[floorKey(x, z, y)] = {
        ...(tex ? { tex } : {}),
        ...(material ? { material } : {}),
        y,
        thickness,
        walkable: true,
        ...surfaceBlockingForTool(tool),
      }
      changed = true
    }
  }

  return changed ? { ...next, floors } : surfaceData
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
    tool,
    packId: tool?.wallFrontPackId,
    textureId: tool?.wallFrontTexId,
    fallbackTexId: activeMaterial?.texId,
    availableBlocks,
    seed: `${id}:front`,
  })
  const back = materialOrTextureForTool({
    tool,
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
  const height = Math.max(0.5, Math.min(8, Number(tool?.wallHeight) || 2.5))
  const segments = []

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

export function makeWallFromDrag(start, end, tool, activeMaterial, availableBlocks) {
  return makeWallsFromDrag(start, end, tool, activeMaterial, availableBlocks)?.[0] || null
}

export function applyWallDrag(surfaceData, start, end, tool, activeMaterial, availableBlocks) {
  const walls = makeWallsFromDrag(start, end, tool, activeMaterial, availableBlocks)
  if (!walls?.length) return surfaceData

  const next = normalizeSurfaceData(surfaceData)
  const nextWalls = { ...next.walls }
  for (const wall of walls) {
    nextWalls[wall.id] = wall
  }

  return {
    ...next,
    walls: nextWalls,
  }
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
  let changed = false

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

  return changed ? { ...next, floors, walls, ceilings, stairs } : surfaceData
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

function wallReachesTop(wall, topY) {
  const height = Math.max(0.5, Number(wall?.height) || DEFAULT_CEILING_HEIGHT)
  return getWallBaseY(wall) + height + 0.05 >= topY
}

function wallBlocksWaterEdge(wall, x, z, direction, baseY, topY) {
  if (!surfaceBlocksWater(wall)) return false
  if (!sameLevel(wall?.y, baseY)) return false
  if (!wallReachesTop(wall, topY)) return false

  const fine = SURFACE_FINE
  const minX = x * fine
  const maxX = (x + 1) * fine
  const minZ = z * fine
  const maxZ = (z + 1) * fine

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
  return Object.values(surface.walls).some(wall => wallBlocksWaterEdge(wall, x, z, direction, baseY, topY))
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
  const surface = normalizeSurfaceData(data)
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

  const dryCellKeys = new Set()
  const waterCells = []

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
        waterCells.push({
          x,
          z,
          baseY: level.baseY,
          topY: candidate?.ceilingY || level.topY,
        })
      }
    }
  }

  return { dryCellKeys, waterCells }
}
