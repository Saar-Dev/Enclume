import { STORY_HEIGHT, getToolElevation, getToolRoomHeightLevels, normalizeCellSelection } from '../../lib/surfaceData.js'

// Extrait de SurfaceEditorScene.jsx (§11.7, PLAN_WORLD_BUILDER_REWORK.md).
function RoomPreviewMaterial() {
  return <meshBasicMaterial color="#5b8dee" transparent opacity={0.2} depthWrite={false} />
}

export default function RoomPreview({ selection, surfaceTool }) {
  const area = normalizeCellSelection(selection)
  if (!area) return null

  const baseY = getToolElevation(surfaceTool)
  const height = getToolRoomHeightLevels(surfaceTool) * STORY_HEIGHT
  const centerX = area.minX + area.width / 2
  const centerZ = area.minZ + area.depth / 2
  const wallY = baseY + height / 2
  return (
    <group>
      <mesh position={[centerX, baseY, centerZ]}>
        <boxGeometry args={[area.width, 0.08, area.depth]} />
        <RoomPreviewMaterial />
      </mesh>
      <mesh position={[centerX, baseY + height, centerZ]}>
        <boxGeometry args={[area.width, 0.08, area.depth]} />
        <RoomPreviewMaterial />
      </mesh>
      <mesh position={[centerX, wallY, area.minZ]}>
        <boxGeometry args={[area.width, height, 0.08]} />
        <RoomPreviewMaterial />
      </mesh>
      <mesh position={[centerX, wallY, area.maxZ + 1]}>
        <boxGeometry args={[area.width, height, 0.08]} />
        <RoomPreviewMaterial />
      </mesh>
      <mesh position={[area.minX, wallY, centerZ]}>
        <boxGeometry args={[0.08, height, area.depth]} />
        <RoomPreviewMaterial />
      </mesh>
      <mesh position={[area.maxX + 1, wallY, centerZ]}>
        <boxGeometry args={[0.08, height, area.depth]} />
        <RoomPreviewMaterial />
      </mesh>
    </group>
  )
}
