import { useMemo } from 'react'
import { classifyRoomFootprintCells } from '../../lib/surfaceData.js'
import { levelToY, roomCellKey } from '../../lib/surfaceCore.js'

// Aperçu vert/rouge partagé par les sous-outils Remodeler (reshape-room) et poignée de mur
// (wall-reshape) — extrait de SurfaceEditorScene.jsx (§11.8, PLAN_WORLD_BUILDER_REWORK.md).
export default function RoomFootprintPaintPreview({ surfaceData, roomId, cellMode, cells, displayLevel }) {
  const classification = useMemo(
    () => classifyRoomFootprintCells(surfaceData, roomId, cells, cellMode),
    [surfaceData, roomId, cellMode, cells],
  )
  const y = levelToY(displayLevel) + 0.06
  return (
    <group renderOrder={44}>
      {classification.cells.map(cell => {
        if (cell.reason === 'already-in-room' || cell.reason === 'not-in-room') return null
        const color = cell.accepted ? '#22c55e' : '#ef4444'
        return (
          <mesh key={roomCellKey(cell.x, cell.z)} position={[cell.x + 0.5, y, cell.z + 0.5]}>
            <boxGeometry args={[0.94, 0.04, 0.94]} />
            <meshBasicMaterial color={color} transparent opacity={0.45} depthWrite={false} depthTest={false} />
          </mesh>
        )
      })}
    </group>
  )
}
