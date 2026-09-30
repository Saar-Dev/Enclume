import { levelToY, yToLevel } from '../../lib/surfaceCore.js'
import { isWorldPointVisibleAtLevel } from '../../lib/surfaceData.js'
import { getEffectRegionColor } from '../../lib/effectRegionColors.js'

// Zones dangereuses déjà posées, visibles indépendamment du mode courant — extrait de
// SurfaceEditorScene.jsx (§11.14, PLAN_WORLD_BUILDER_REWORK.md).
export default function RuntimeEffectRegions({ regions = [], surfaceData, displayLevel = 0 }) {
  return regions.map(region => {
    const bounds = region?.bounds
    const sliceBottom = levelToY(displayLevel)
    const sliceTop = levelToY(displayLevel + 1)
    if (!bounds) return null
    const centerX = (bounds.min.x + bounds.max.x) / 2
    const centerZ = (bounds.min.z + bounds.max.z) / 2
    const intersectsSlice = bounds.max.y > sliceBottom && bounds.min.y < sliceTop
    const visibleInOpenRoom = bounds.max.y <= sliceBottom
      && yToLevel(bounds.min.y) < displayLevel
      && isWorldPointVisibleAtLevel(surfaceData, displayLevel, centerX, centerZ, bounds.min.y)
    if (!intersectsSlice && !visibleInOpenRoom) return null
    const size = [bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z]
    const center = [
      centerX,
      (bounds.min.y + bounds.max.y) / 2,
      centerZ,
    ]
    return (
      <mesh key={region.id} position={center} renderOrder={20}>
        <boxGeometry args={size} />
        <meshBasicMaterial color={getEffectRegionColor(region)} transparent opacity={0.13} depthWrite={false} />
      </mesh>
    )
  })
}
