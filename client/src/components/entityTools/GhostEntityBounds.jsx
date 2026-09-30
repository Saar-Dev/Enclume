import { Edges } from '@react-three/drei'

// Ghost entité — repli d'aperçu tant que le GLB n'est pas chargé (Suspense fallback) — extrait de
// Editor3D.jsx (§16.8, PLAN_WORLD_BUILDER_REWORK.md).
export default function GhostEntityBounds({ position, blueprint, r }) {
  if (!position || !blueprint) return null
  const { x, y, z } = position
  const rot = r * (Math.PI / 2)
  const width = blueprint.geometry?.width ?? 1
  const height = blueprint.geometry?.height ?? 1
  const depth = blueprint.geometry?.depth ?? 1
  const authoredOrigin = blueprint.geometry?.origin === 'floor-center' || blueprint.geometry?.origin === 'wall-back-center'
  return (
    <group position={[authoredOrigin ? x : x + width / 2, y, authoredOrigin ? z : z + depth / 2]} rotation={[0, rot, 0]}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color="#5b8dee" transparent opacity={0.18} depthWrite={false} />
        <Edges color="#7fb0ff" transparent opacity={0.9} />
      </mesh>
    </group>
  )
}
