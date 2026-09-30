import { useMemo } from 'react'
import { ConnectorSegment } from '../SurfaceDungeonScene.jsx'
import { normalizeSurfaceData } from '../../lib/surfaceData.js'
import { STORY_HEIGHT } from '../../lib/surfaceCore.js'
import { roomsWallRenderPaths } from '../../lib/roomWalls.js'
import {
  makeDoorConnectorFromWallPoint,
  makeElevatorConnectorFromCell,
  makeLadderConnectorFromCell,
} from '../../lib/connectors.js'

// Extrait de SurfaceEditorScene.jsx (§11.8, PLAN_WORLD_BUILDER_REWORK.md).
export default function ConnectorPreview({ drag, surfaceData, surfaceTool }) {
  const curveWallsById = useMemo(() => {
    const rooms = normalizeSurfaceData(surfaceData).rooms
    return new Map(
      roomsWallRenderPaths(rooms)
        .filter(wall => wall.axis === 'arc' && wall.curveId)
        .map(wall => [wall.curveId, wall]),
    )
  }, [surfaceData])
  if (!drag) return null
  const connector = surfaceTool?.connectorType === 'door'
    ? makeDoorConnectorFromWallPoint(surfaceData, drag.end, surfaceTool)
    : surfaceTool?.connectorType === 'ladder'
      ? makeLadderConnectorFromCell(surfaceData, drag.end, surfaceTool)
      : makeElevatorConnectorFromCell(surfaceData, drag.end, surfaceTool)
  if (!connector) return null

  if (connector.type === 'door') {
    return (
      <ConnectorSegment
        connector={{ id: 'connector-preview', ...connector }}
        curveWall={connector.curveId ? curveWallsById.get(connector.curveId) || null : null}
        opacity={0.68}
        displayLevel={Number(connector.level) || 0}
      />
    )
  }

  const height = Math.max(0.2, (Number(connector.topY) || connector.y + STORY_HEIGHT) - (Number(connector.y) || 0))
  return (
    <mesh position={[connector.x + 0.5, connector.y + height / 2, connector.z + 0.5]} renderOrder={35}>
      <boxGeometry args={[1, height, 1]} />
      <meshBasicMaterial color="#a78bfa" transparent opacity={0.34} depthWrite={false} />
    </mesh>
  )
}
