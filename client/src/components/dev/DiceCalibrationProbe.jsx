import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// ─── DiceCalibrationProbe ─────────────────────────────────────────────────────
// Outil dev — composant JETABLE, pas branché à la production.
// Autonome : ne dépend ni de DiceMesh ni de getFaceNormal/FACE_NORMALS (diceMath.js) —
// sert justement à vérifier/calibrer cette donnée, ne doit pas en dépendre ici.
// Pose statique immédiate (pas de SLERP/bounce) : oriente `normal` vers la caméra.
// `clockDeg` : rotation additionnelle autour de l'axe de visée (caméra→dé) — la face affichée
// ne change pas (même normale vers la caméra), seul son "horloge" (orientation du chiffre à
// l'écran : haut/bas/gauche/droite) varie. Sert à vérifier la lisibilité sous tous les angles.
export default function DiceCalibrationProbe({ glbPath, normal, clockDeg = 0 }) {
  const { camera } = useThree()
  const { nodes } = useGLTF(glbPath)
  const meshRef = useRef()

  const { geometry, material } = useMemo(() => {
    const meshNode = Object.values(nodes).find(n => n.isMesh)
    return {
      geometry: meshNode?.geometry ?? new THREE.BoxGeometry(1, 1, 1),
      material: meshNode?.material ?? new THREE.MeshStandardMaterial(),
    }
  }, [nodes])

  useEffect(() => {
    if (!meshRef.current) return
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    const viewAxis = camDir.clone().negate().normalize()
    const fn = new THREE.Vector3(...normal)
    const align = new THREE.Quaternion().setFromUnitVectors(fn, viewAxis)
    const clock = new THREE.Quaternion().setFromAxisAngle(viewAxis, THREE.MathUtils.degToRad(clockDeg))
    // clock appliqué après align (même axe que la normale alignée) — ne change pas la face visible.
    meshRef.current.quaternion.copy(clock.multiply(align))
  }, [normal, clockDeg, camera])

  return (
    <group scale={520}>
      <mesh ref={meshRef} geometry={geometry} material={material} />
    </group>
  )
}
