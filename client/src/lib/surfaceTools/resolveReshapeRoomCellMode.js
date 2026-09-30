import { getRoomFootprintCells, normalizeSurfaceData, roomCellKey } from '../surfaceCore.js'

// Décide si le premier clic d'un glissé Remodeler ajoute ou retire des cases — extrait de
// SurfaceEditorScene.jsx (§11.12, PLAN_WORLD_BUILDER_REWORK.md). `null` = pas de salle sélectionnée,
// le composant garde alors son comportement d'origine (ne pas démarrer de glissé).
export function resolveReshapeRoomCellMode(surfaceData, roomId, start) {
  const selectedRoom = roomId ? normalizeSurfaceData(surfaceData).rooms?.[roomId] : null
  if (!selectedRoom) return null
  const footprintKeys = new Set(getRoomFootprintCells(selectedRoom).map(cell => roomCellKey(cell.x, cell.z)))
  return footprintKeys.has(roomCellKey(start.x, start.z)) ? 'remove' : 'add'
}
