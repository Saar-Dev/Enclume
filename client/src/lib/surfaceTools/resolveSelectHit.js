import { findRoomAtCell, findRoomsInSelection, roomToSurfaceToolPatch } from '../surfaceData.js'

// Partie pure du clic en mode Sélection — extrait de SurfaceEditorScene.jsx (§11.12,
// PLAN_WORLD_BUILDER_REWORK.md). Décide QUOI a été touché (connecteur, une salle, plusieurs
// salles ou aucune) ; les effets de bord (`onSurfaceToolChange`/`onSurfaceConnectorSelect`/
// `onSurfaceRoomSelect`, `preventDefault`/`stopPropagation`) restent dans le composant.
//
// `findConnectorAtWorldPoint` reste injectée (pas importée) : c'est un `useCallback` fermé sur
// l'état interne du composant (raycaster/connecteurs rendus), pas une fonction pure de `lib/` —
// l'importer directement aurait recréé une dépendance cachée sur le composant plutôt que de la
// rendre explicite en paramètre.
export function resolveSelectHit({ surfaceData, finalDrag, editLevel, isSingleCell, clickPoint, findConnectorAtWorldPoint }) {
  if (isSingleCell) {
    const connectorHit = findConnectorAtWorldPoint(clickPoint, editLevel)
    if (connectorHit) return { kind: 'connector', connectorId: connectorHit.id }
  }

  const hits = isSingleCell
    ? [findRoomAtCell(surfaceData, finalDrag.end, editLevel)].filter(Boolean)
    : findRoomsInSelection(surfaceData, finalDrag, editLevel)

  if (hits.length === 1 && hits[0]?.room) {
    const patch = roomToSurfaceToolPatch(hits[0].room)
    // `patch` n'est falsy que si `hits[0].room` est absent — déjà exclu par la garde ci-dessus
    // (`hits[0]?.room`). Gardé explicite pour préserver le no-op d'origine plutôt que le supposer
    // inatteignable.
    if (!patch) return { kind: 'none' }
    return { kind: 'room', roomId: hits[0].id, patch }
  }

  return { kind: 'rooms', roomIds: hits.map(hit => hit.id) }
}
