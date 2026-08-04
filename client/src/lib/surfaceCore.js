// surfaceCore.js — Fondations partagées de surface_data (constantes, forme du document, getters)
// Extrait de surfaceData.js, restructuration anti-cycle du PLAN_REFACTOR_SURFACE.md.
// Ce module ne dépend d'aucun module métier (materialDecision, surfaceGeometry, roomWalls,
// connectors, surfaceRooms, surfaceStairs, surfaceData) : c'est la base commune que tous les
// autres importent, jamais l'inverse.

import { clampNumber, formatLevel } from './surfaceUtils.js'
import { roomMaximumHeightLevels } from '../../../shared/world/roomGeometry.js'
import { SURFACE_DATA_VERSION } from '../../../shared/world/surfaceDocument.js'

export const SURFACE_FINE = 4
const DEFAULT_FLOOR_THICKNESS = 0.25
const DEFAULT_CEILING_HEIGHT = 2.5

export const STORY_HEIGHT = 2.5

export function levelToY(level) {
  return Math.trunc(clampNumber(level, -8, 16, 0)) * STORY_HEIGHT
}

export function yToLevel(y) {
  return Math.round((Number(y) || 0) / STORY_HEIGHT)
}

export function getRoomBaseY(room) {
  if (Number.isFinite(Number(room?.y))) return Number(room.y)
  return levelToY(room?.level)
}

export function getRoomHeightLevels(room) {
  return Math.max(1, Math.min(12, roomMaximumHeightLevels(room, STORY_HEIGHT)))
}

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

// ===================================================================
// Normalisation et sélection
// ===================================================================

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

export function normalizeCellSelection(selection) {
  if (!selection?.start || !selection?.end) return null
  const minX = Math.min(selection.start.x, selection.end.x)
  const maxX = Math.max(selection.start.x, selection.end.x)
  const minZ = Math.min(selection.start.z, selection.end.z)
  const maxZ = Math.max(selection.start.z, selection.end.z)
  return { minX, maxX, minZ, maxZ, width: maxX - minX + 1, depth: maxZ - minZ + 1 }
}

// ===================================================================
// Getters d'outils
// ===================================================================

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

// ===================================================================
// Sols et plafonds : épaisseurs et clés
// ===================================================================

export function getFloorThickness(floor) {
  return Math.max(0.05, Number(floor?.thickness) || DEFAULT_FLOOR_THICKNESS)
}

export function getCeilingThickness(ceiling) {
  return Math.max(0.05, Number(ceiling?.thickness) || DEFAULT_FLOOR_THICKNESS)
}

export function getSupportThickness(value) {
  return Math.max(0.05, Number(value) || DEFAULT_FLOOR_THICKNESS)
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

export function getFloorTopY(id, floor) {
  const { y } = parseFloorKey(id, floor)
  return y + getFloorThickness(floor) / 2
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

// ===================================================================
// Salles : cellules d'empreinte
// ===================================================================

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

function sortRoomCells(cells) {
  return [...cells].sort((left, right) => left.z - right.z || left.x - right.x)
}

export function roomCellKey(x, z) {
  return `${Math.trunc(Number(x) || 0)}:${Math.trunc(Number(z) || 0)}`
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
  for (let z = bounds.minZ; z <= bounds.maxZ; z += 1)
    for (let x = bounds.minX; x <= bounds.maxX; x += 1)
      cells.push({ x, z })
  return cells
}

export function roomIncludesCell(room, x, z) {
  const key = roomCellKey(x, z)
  return getRoomFootprintCells(room).some(cell => roomCellKey(cell.x, cell.z) === key)
}

// ===================================================================
// Salles : hauteurs et épaisseurs
// ===================================================================

export function getRoomFloorThickness(room) {
  return Math.max(0.05, Number(room?.floorThickness) || DEFAULT_FLOOR_THICKNESS)
}

export function getRoomCeilingThickness(room) {
  return Math.max(0.05, Number(room?.ceilingThickness) || getRoomFloorThickness(room))
}

export function getRoomHeight(room) {
  return getRoomHeightLevels(room) * STORY_HEIGHT
}

export function getRoomTopY(room) {
  return getRoomBaseY(room) + getRoomHeight(room)
}
