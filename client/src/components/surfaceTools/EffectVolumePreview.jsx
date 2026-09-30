import { STORY_HEIGHT, getToolElevation, normalizeCellSelection } from '../../lib/surfaceData.js'

// Extrait de SurfaceEditorScene.jsx (§11.7, PLAN_WORLD_BUILDER_REWORK.md).
export default function EffectVolumePreview({ selection, surfaceTool }) {
  const area = normalizeCellSelection(selection)
  if (!area) return null
  const baseY = getToolElevation(surfaceTool)
  const height = Math.max(0.1, Number(surfaceTool?.effectHeight) || STORY_HEIGHT)
  return (
    <mesh position={[area.minX + area.width / 2, baseY + height / 2, area.minZ + area.depth / 2]} renderOrder={36}>
      <boxGeometry args={[area.width, height, area.depth]} />
      <meshBasicMaterial color="#fb7185" transparent opacity={0.2} depthWrite={false} />
    </mesh>
  )
}
