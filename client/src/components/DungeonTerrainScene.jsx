import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildDungeonTerrainMesh } from '../lib/buildDungeonTerrainMesh.js'
import { createReliefGeometryFromQuadData } from '../lib/reliefGeometry.js'

const ROLE_TINT = {
  floor: '#d0b889',
  bevel: '#a9845f',
  wall: '#4b3428',
}

// DungeonTerrainScene
//
// Prototype renderer "tactical diorama":
// - current voxel_data remains the source of truth
// - each occupied X/Z column becomes one floor surface
// - sides become continuous walls when adjacent columns are lower
//
// This is deliberately game-view only for now. Editor3D still renders individual
// voxels so its face-based raycast and placement tools remain unchanged.
export default function DungeonTerrainScene({ voxels, textureMaterials }) {
  const groups = useMemo(() => buildDungeonTerrainMesh(voxels), [voxels])

  const geometryMap = useMemo(() => {
    const map = {}

    for (const [key, g] of Object.entries(groups)) {
      if (g.indices.length === 0) continue

      const relief = g.role !== 'bevel' ? textureMaterials[g.texId]?.relief : null
      const reliefGeo = createReliefGeometryFromQuadData({
        positions: g.positions,
        normals: g.normals,
        uvs: g.uvs,
        indices: g.indices,
        profile: relief,
      })
      const geo = reliefGeo || new THREE.BufferGeometry()
      if (!reliefGeo) {
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.positions), 3))
        geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(g.normals), 3))
        geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.uvs), 2))
        const vertexCount = g.positions.length / 3
        const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array
        geo.setIndex(new THREE.BufferAttribute(new IndexArray(g.indices), 1))
      }
      geo.computeBoundingSphere()

      map[key] = { geo, texId: g.texId, physIdx: g.physIdx, role: g.role }
    }

    return map
  }, [groups, textureMaterials])

  const materialMap = useMemo(() => {
    const map = {}

    for (const [key, { texId, physIdx, role }] of Object.entries(geometryMap)) {
      const source = textureMaterials[texId]?.faceMaterials[physIdx]
      if (!source) continue

      const mat = source.clone()
      mat.color = new THREE.Color(ROLE_TINT[role] ?? '#ffffff')
      mat.needsUpdate = true
      map[key] = mat
    }

    return map
  }, [geometryMap, textureMaterials])

  useEffect(() => {
    return () => {
      Object.values(geometryMap).forEach(({ geo }) => geo.dispose())
    }
  }, [geometryMap])

  useEffect(() => {
    return () => {
      Object.values(materialMap).forEach((mat) => mat.dispose())
    }
  }, [materialMap])

  return (
    <>
      {Object.entries(geometryMap).map(([key, { geo }]) => {
        const material = materialMap[key]
        if (!material) return null
        return <mesh key={key} geometry={geo} material={material} receiveShadow />
      })}
    </>
  )
}
