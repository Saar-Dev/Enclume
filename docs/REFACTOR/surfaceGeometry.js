// surfaceGeometry.js — Géométrie des murs (rendu, drag, bounds)
// Extrait de surfaceData.js, Lot 5a du PLAN_REFACTOR_SURFACE.md

import { clampNumber, formatLevel } from './surfaceUtils.js'
import { STORY_HEIGHT } from './surfaceCore.js'
import { SURFACE_FINE } from './surfaceData.js'
import {
  materialOrTextureForTool,
  surfaceBlockingForTool,
  toolForMaterialFace,
} from './materialDecision.js'
import { addMissingWalls } from './roomWalls.js'
import {
  getToolElevation,
  getToolFloorThickness,
  getToolLevel,
  getToolMovementMultiplier,
  getToolWallHeightLevels,
  normalizeSurfaceData,
} from './surfaceData.js'

// ----- Épaisseurs de mur -----

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

// ----- Bornes de mur -----

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

// ----- Boîte de rendu -----

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

// ----- Segment de mur -----

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

// ----- Création de murs par drag -----

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