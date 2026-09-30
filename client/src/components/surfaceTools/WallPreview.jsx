import { getWallRenderBox, makeWallsFromDrag } from '../../lib/surfaceGeometry.js'

// Extrait de SurfaceEditorScene.jsx (§11.7, PLAN_WORLD_BUILDER_REWORK.md).
export default function WallPreview({ drag, surfaceTool, activeMaterial, availableBlocks }) {
  const walls = makeWallsFromDrag(drag?.start, drag?.end, surfaceTool, activeMaterial, availableBlocks)
  if (!walls?.length) return null

  return (
    <>
      {walls.map(wall => {
        const box = getWallRenderBox(wall)
        if (!box) return null
        return (
          <mesh key={wall.id} position={box.position} rotation={[0, box.rotationY || 0, 0]}>
            <boxGeometry args={box.args} />
            <meshBasicMaterial color="#5b8dee" transparent opacity={0.28} depthWrite={false} />
          </mesh>
        )
      })}
    </>
  )
}
