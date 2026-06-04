import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { buildCulledMesh } from '../lib/buildCulledMesh.js'
import Voxel from './Voxel.jsx'

// CulledVoxelScene — remplace la boucle Object.values(voxels).map(<Voxel>) dans Canvas3D.
//
// Cubes  → une <mesh> par groupe (texId × face physique P32) avec géométrie fusionnée culled.
//          Draw calls : nb_textures × 6 max (au lieu de N voxels).
//          Faces intérieures entre cubes adjacents éliminées.
//
// Non-cubes (slab_bottom, slab_top, slope, wedge) → <Voxel> individuel inchangé.
//
// Phase B  : ROTATION_FACE_MAP implémentée dans buildCulledMesh — cubes r≠0 affichent
//            la bonne texture par face (origPhysIdx = ROTATION_FACE_MAP[r][physIdx]).
export default function CulledVoxelScene({ voxels, textureMaterials }) {
  const nonCubeVoxels = useMemo(
    () => Object.values(voxels).filter(v => v.geo !== 'cube'),
    [voxels]
  )

  // Données brutes (pure JS, pas de Three.js)
  const groups = useMemo(() => buildCulledMesh(voxels), [voxels])

  // BufferGeometry objects — recréés quand groups change
  const geometryMap = useMemo(() => {
    const map = {}
    for (const [key, g] of Object.entries(groups)) {
      if (g.indices.length === 0) continue
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.positions), 3))
      geo.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(g.normals),   3))
      geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(g.uvs),        2))
      geo.setIndex(new THREE.BufferAttribute(new Uint32Array(g.indices), 1))
      map[key] = { geo, texId: g.texId, physIdx: g.physIdx }
    }
    return map
  }, [groups])

  // Dispose explicite — R3F n'auto-dispose pas quand geometry prop change sur un mesh monté
  useEffect(() => {
    return () => {
      Object.values(geometryMap).forEach(({ geo }) => geo.dispose())
    }
  }, [geometryMap])

  return (
    <>
      {Object.entries(geometryMap).map(([key, { geo, texId, physIdx }]) => {
        const material = textureMaterials[texId]?.faceMaterials[physIdx]
        if (!material) return null
        return <mesh key={key} geometry={geo} material={material} />
      })}

      {nonCubeVoxels.map(v => (
        <Voxel
          key={`${v.x}:${v.y}:${v.z}`}
          position={[v.x, v.y, v.z]}
          textureMaterials={textureMaterials[v.tex]}
          geometry={v.geo}
          rotation={v.r}
        />
      ))}
    </>
  )
}
