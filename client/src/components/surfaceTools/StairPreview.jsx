import { makeStairFromSelection, stairStepBoxes } from '../../lib/surfaceData.js'

// Extrait de SurfaceEditorScene.jsx (§11.7, PLAN_WORLD_BUILDER_REWORK.md).
export default function StairPreview({ drag, surfaceTool, activeMaterial, availableBlocks }) {
  const stair = makeStairFromSelection(drag, surfaceTool, activeMaterial, availableBlocks)
  if (!stair) return null

  return (
    <>
      {stairStepBoxes(stair).map((step, index) => (
        <mesh key={index} position={step.position}>
          <boxGeometry args={step.args} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}
