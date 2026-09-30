import {
  applyBridgeSelection,
  applyFloorSelection,
  applyStairSelection,
  eraseSurfaceSelection,
} from '../surfaceData.js'
import { applyWallDrag } from '../surfaceGeometry.js'

// Registre mode → fonction de pose, extrait du chaînage de ternaires de
// SurfaceEditorScene.jsx (§11.9, PLAN_WORLD_BUILDER_REWORK.md — décomposition en un fichier par
// responsabilité, le moteur commun grossit par la preuve). Couvre seulement les modes qui
// partageaient déjà ce chaînage (wall/stair/bridge/erase, plus le repli sol) — select/room/
// connector/effect/reshape-room/wall-reshape/paint-wall gèrent des effets de bord (panneaux,
// hover, clés d'arête) au-delà d'un simple calcul de `nextData`, hors périmètre de ce registre.
const APPLY_BY_MODE = {
  wall: (surfaceData, drag, tool, activeMaterial, availableBlocks) =>
    applyWallDrag(surfaceData, drag.start, drag.end, tool, activeMaterial, availableBlocks),
  stair: applyStairSelection,
  bridge: applyBridgeSelection,
  erase: (surfaceData, drag, tool) => eraseSurfaceSelection(surfaceData, drag, tool),
}

export function applyToolMode(mode, surfaceData, drag, tool, activeMaterial, availableBlocks) {
  const applyFn = APPLY_BY_MODE[mode] || applyFloorSelection
  return applyFn(surfaceData, drag, tool, activeMaterial, availableBlocks)
}
