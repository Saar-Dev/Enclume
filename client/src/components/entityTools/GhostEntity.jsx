import { Suspense } from 'react'
import EntityMesh from '../EntityMesh.jsx'
import GhostEntityBounds from './GhostEntityBounds.jsx'

// Fantôme d'entité pendant la pose — extrait de Editor3D.jsx (§16.8, PLAN_WORLD_BUILDER_REWORK.md).
export default function GhostEntity({ position, blueprint, r }) {
  if (!position || !blueprint) return null
  const entity = {
    id: `preview:${blueprint.id}`,
    blueprint_id: blueprint.id,
    pos_x: position.x,
    pos_y: position.z,
    pos_z: position.y,
    r,
    state: {},
    current_state_id: 0,
  }
  return (
    <Suspense fallback={<GhostEntityBounds position={position} blueprint={blueprint} r={r} />}>
      <EntityMesh
        entity={entity}
        blueprint={blueprint}
        entityTextureMaterials={null}
        sceneOpacity={1}
        isPreview
        isSelected
      />
    </Suspense>
  )
}
