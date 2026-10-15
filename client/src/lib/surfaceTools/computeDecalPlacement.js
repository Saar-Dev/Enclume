import { makeWallDecorationFromWallPoint } from '../connectors.js'
import { addRoomWallDecoration } from '../surfaceRooms.js'

// Hauteur par défaut d'un décor (mètres) — la largeur se déduit du ratio réel de l'image
// (width_px/height_px, Lot 0) au moment où l'outil choisit l'image, pas ici.
export const DEFAULT_DECAL_HEIGHT_M = 0.5

// Partie pure de la pose d'un décor — même patron que computeConnectorPlacement.js. La gestion de
// l'échec, la remise à zéro de `connectorWallEdgeKeys` et les événements (preventDefault/
// stopPropagation) restent dans le composant.
export function computeDecalPlacement(surfaceData, wallPoint, tool) {
  const geo = makeWallDecorationFromWallPoint(surfaceData, wallPoint, tool)
  if (!geo) return { surfaceData, error: 'Aucun mur valide sous le curseur pour poser ce décor.' }

  const decoration = {
    ...geo,
    assetId: tool?.decalAssetId || null,
    widthM: Number(tool?.decalWidthM) || DEFAULT_DECAL_HEIGHT_M,
    heightM: Number(tool?.decalHeightM) || DEFAULT_DECAL_HEIGHT_M,
    mirror: !!tool?.decalMirror,
  }
  return addRoomWallDecoration(surfaceData, decoration.roomId, decoration)
}
