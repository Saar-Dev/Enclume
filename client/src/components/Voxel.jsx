// ─── Voxel individuel ─────────────────────────────────────────────────────────
// Composant partagé entre Canvas3D (lecture) et Editor3D (édition).
//
// Props :
//   position         : [x, y, z] — coordonnées brutes (pas de +0.5 ici, fait dans le rendu)
//   textureMaterials : { faceMaterials } — issu de textureMaterials[v.tex]
//   geometry         : string depuis voxel_data.geo — 'cube'|'slab_bottom'|'slab_top'|'slope'|'wedge'
//   rotation         : 0/1/2/3 — quarts de tour axe Y
//
// P23 : bounding box cubique invisible pour raycasting uniforme,
//        quelle que soit la géométrie visuelle réelle.
//
// P31 : geometry vient de voxel_data, pas de textureMaterials.
//
// Géométries supportées V1 :
//   cube        → BoxGeometry 1×1×1
//   slab_bottom → BoxGeometry 1×0.5×1, décalé vers le bas
//   slab_top    → BoxGeometry 1×0.5×1, décalé vers le haut
//   slope       → placeholder cube (affinement V2)
//   wedge       → placeholder cube (affinement V2)

import ReliefBoxGeometry from './ReliefBoxGeometry.jsx'

const VOXEL_SIZE = 1

export default function Voxel({ position, textureMaterials, geometry, rotation }) {
  if (!textureMaterials) return null  // texture inconnue (deprecated ou non chargée) — silencieux

  const [px, py, pz] = position
  const rot = (rotation || 0) * (Math.PI / 2)

  // Décalage slab : la géométrie est de hauteur 0.5, centrée dans la case 1×1×1.
  // slab_bottom → offset -0.25 (ancré en bas de la case)
  // slab_top    → offset +0.25 (ancré en haut de la case)
  const yOffset = geometry === 'slab_bottom' ? -0.25
    : geometry === 'slab_top' ? 0.25
    : 0

  // Géométrie visuelle selon le type.
  // slope et wedge : placeholder cube en attendant les BufferGeometry custom (V2).
  // ⚠️ Le raycasting se fait TOUJOURS sur la bounding box invisible — jamais sur la géométrie visuelle (P23).
  const renderGeometry = () => {
    switch (geometry) {
      case 'slab_bottom':
      case 'slab_top':
        return <ReliefBoxGeometry args={[1, 0.5, 1]} profile={textureMaterials.relief} />
      case 'slope':
      case 'wedge':
        return <ReliefBoxGeometry args={[1, 1, 1]} profile={textureMaterials.relief} />  // placeholder
      default:  // 'cube'
        return <ReliefBoxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} profile={textureMaterials.relief} />
    }
  }

  return (
    <mesh
      position={[px + 0.5, py + 0.5 + yOffset, pz + 0.5]}
      rotation={[0, rot, 0]}
      material={textureMaterials.faceMaterials}
      userData={{ isVoxel: true, position }}
    >
      {renderGeometry()}
      {/* Bounding box invisible — raycasting uniforme quelle que soit la géométrie (P23) */}
      <mesh visible={false} userData={{ isVoxel: true, position }}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </mesh>
  )
}
