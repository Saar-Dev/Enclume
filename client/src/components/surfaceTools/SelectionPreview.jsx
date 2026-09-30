import { getToolElevation, normalizeCellSelection } from '../../lib/surfaceData.js'

// Extrait de SurfaceEditorScene.jsx (§11.7, PLAN_WORLD_BUILDER_REWORK.md).
export default function SelectionPreview({ selection, surfaceTool }) {
  const area = normalizeCellSelection(selection)
  if (!area) return null

  return (
    <mesh position={[area.minX + area.width / 2, getToolElevation(surfaceTool) + 0.08, area.minZ + area.depth / 2]}>
      <boxGeometry args={[area.width, 0.04, area.depth]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.22} depthWrite={false} />
    </mesh>
  )
}
