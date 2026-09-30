import { getToolElevation, getToolFloorThickness, normalizeCellSelection } from '../../lib/surfaceData.js'

// Aperçu du repli générique (sol) et de l'effacement (même géométrie, teinte rouge, épaisseur fixe
// fine) — extrait de SurfaceEditorScene.jsx (§11.7, PLAN_WORLD_BUILDER_REWORK.md, décomposition en
// un fichier par responsabilité).
export default function FloorPreview({ selection, surfaceTool }) {
  const area = normalizeCellSelection(selection)
  if (!area) return null

  const y = getToolElevation(surfaceTool)
  const isErase = selection?.mode === 'erase'
  const thickness = isErase ? 0.03 : getToolFloorThickness(surfaceTool)
  const color = isErase ? '#ff5c7a' : '#5b8dee'
  const opacity = isErase ? 0.28 : 0.35

  return (
    <mesh
      position={[area.minX + area.width / 2, isErase ? y + 0.08 : y, area.minZ + area.depth / 2]}
    >
      <boxGeometry args={[area.width, thickness, area.depth]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}
