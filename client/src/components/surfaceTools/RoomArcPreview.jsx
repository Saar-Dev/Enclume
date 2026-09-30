import { useMemo } from 'react'
import { STORY_HEIGHT, SURFACE_FINE, levelToY } from '../../lib/surfaceCore.js'
import { getWallRenderBox } from '../../lib/surfaceGeometry.js'
import { makeRoomBoundaryArc, sampleRoomBoundaryArc } from '../../../../shared/world/roomGeometry.js'

// Aperçu de l'arrondi de coin sur les murs sélectionnés — extrait de SurfaceEditorScene.jsx
// (§11.14, PLAN_WORLD_BUILDER_REWORK.md).
export default function RoomArcPreview({ room, displayLevel, selectedKeys, angleDegrees, sideMultiplier }) {
  const preview = useMemo(() => {
    const built = makeRoomBoundaryArc(room, selectedKeys, angleDegrees, sideMultiplier)
    if (built.error) return null
    const points = sampleRoomBoundaryArc(built.arc)
    return points.slice(0, -1).map((from, index) => ({
      from,
      to: points[index + 1],
    }))
  }, [angleDegrees, room, selectedKeys, sideMultiplier])
  if (!preview) return null

  const y = levelToY(displayLevel)
  const thickness = Math.max(2, Number(room.wallThickness) || 1)
  return preview.map((segment, index) => {
    const box = getWallRenderBox({
      axis: 'segment',
      x0: segment.from.x * SURFACE_FINE,
      x1: segment.to.x * SURFACE_FINE,
      z0: segment.from.z * SURFACE_FINE,
      z1: segment.to.z * SURFACE_FINE,
      y,
      height: STORY_HEIGHT,
      thickness,
    })
    if (!box) return null
    return (
      <mesh
        key={`room-arc-preview:${index}`}
        position={box.position}
        rotation={[0, box.rotationY || 0, 0]}
        renderOrder={44}
      >
        <boxGeometry args={box.args} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.58} depthWrite={false} />
      </mesh>
    )
  })
}
