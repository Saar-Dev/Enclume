// surfaceStairs.js — Création et rendu des escaliers
// Extrait de surfaceData.js, Lot 7a du PLAN_REFACTOR_SURFACE.md

import { formatLevel } from './surfaceUtils.js'
import { STORY_HEIGHT } from './surfaceCore.js'
import {
  surfaceBlockingForTool,
  materialOrTextureForTool,
} from './materialDecision.js'
import {
  getToolElevation,
  getToolFloorThickness,
  getToolStairRise,
  getToolMovementMultiplier,
  getSupportThickness,
  normalizeCellSelection,
  normalizeSurfaceData,
} from './surfaceData.js'

const STAIR_STEPS_PER_CELL = 4

export function makeStairFromSelection(selection, tool, activeMaterial, availableBlocks) {
  const area = normalizeCellSelection(selection)
  if (!area) return null
  const dx = selection.end.x - selection.start.x
  const dz = selection.end.z - selection.start.z
  const axis = Math.abs(dx) >= Math.abs(dz) ? 'x' : 'z'
  const dir = axis === 'x' ? (dx >= 0 ? 1 : -1) : (dz >= 0 ? 1 : -1)
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
    id, axis, dir, minX: area.minX, maxX: area.maxX, minZ: area.minZ, maxZ: area.maxZ,
    width, run, steps,
    visualSteps: steps * STAIR_STEPS_PER_CELL,
    riseSteps: steps * STAIR_STEPS_PER_CELL,
    y, topY, rise, supportThickness,
    walkable: true, connectsLevels: true, movementMode: 'stairs',
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
  const run = Math.max(1, Number(stair.run) || (stair.axis === 'x' ? (stair.maxX - stair.minX + 1) : (stair.maxZ - stair.minZ + 1)))
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
      boxes.push({ position: [alongCenter, baseY + height / 2, stair.minZ + (stair.maxZ - stair.minZ + 1) / 2], args: [stepRun, height, stair.maxZ - stair.minZ + 1] })
    } else {
      boxes.push({ position: [stair.minX + (stair.maxX - stair.minX + 1) / 2, baseY + height / 2, alongCenter], args: [stair.maxX - stair.minX + 1, height, stepRun] })
    }
  }
  return boxes
}

export function applyStairSelection(surfaceData, selection, tool, activeMaterial, availableBlocks) {
  const stair = makeStairFromSelection(selection, tool, activeMaterial, availableBlocks)
  if (!stair) return surfaceData
  const next = normalizeSurfaceData(surfaceData)
  return { ...next, stairs: { ...next.stairs, [stair.id]: stair } }
}