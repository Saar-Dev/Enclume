import { WallDecorationPlane } from '../SurfaceDungeonScene.jsx'
import { normalizeSurfaceData, roomsWallSegments } from '../../lib/surfaceData.js'
import { makeWallDecorationFromWallPoint } from '../../lib/connectors.js'
import { findWallDecorationPanel } from '../../lib/wallDecorationGeometry.js'
import { DEFAULT_DECAL_HEIGHT_M } from '../../lib/surfaceTools/computeDecalPlacement.js'

// Fantôme semi-transparent qui suit la souris avant la pose — même patron que
// ConnectorPreview.jsx (recalcul en direct depuis le point survolé, rien de stocké).
export default function DecalPreview({ drag, surfaceData, surfaceTool, catalogEntry }) {
  if (!drag || !catalogEntry?.texture) return null
  const geo = makeWallDecorationFromWallPoint(surfaceData, drag.end, surfaceTool)
  if (!geo) return null

  const decoration = {
    ...geo,
    widthM: Number(surfaceTool?.decalWidthM) || DEFAULT_DECAL_HEIGHT_M,
    heightM: Number(surfaceTool?.decalHeightM) || DEFAULT_DECAL_HEIGHT_M,
    mirror: !!surfaceTool?.decalMirror,
  }
  const surface = normalizeSurfaceData(surfaceData)
  const panel = findWallDecorationPanel(roomsWallSegments(surface.rooms), decoration)
  if (!panel) return null

  return (
    <WallDecorationPlane decoration={decoration} panel={panel} catalogEntry={catalogEntry} opacity={0.55} />
  )
}
