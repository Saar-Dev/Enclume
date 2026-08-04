// surfaceCore.js — Constantes et accesseurs partagés du module surface
// Extrait de surfaceData.js, Lot 2b du PLAN_REFACTOR_SURFACE.md
// Sert de base commune à surfaceData.js et roomWalls.js sans dépendance circulaire.

import { clampNumber } from './surfaceUtils.js'
import { roomMaximumHeightLevels } from '../../../shared/world/roomGeometry.js'

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