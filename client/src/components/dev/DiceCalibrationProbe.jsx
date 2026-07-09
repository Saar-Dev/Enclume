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
// `tiltDeg` : rotation manuelle autour de l'axe X écran (horizontal, perpendiculaire à la vue) —
// demandé par Saar pour le D4 (convention de lecture "sommet vers le haut", pas face caméra comme
// les autres dés). ATTENTION : contrairement à clockDeg, ceci DÉVIE la face de l'alignement exact
// face→caméra — confort de lecture visuelle uniquement, pas une calibration précise. Reset à 0
// pour revoir l'alignement exact calibré.
export default function DiceCalibrationProbe({ glbPath, normal, clockDeg = 0, tiltDeg = 0 }) {
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
    const worldUp = new THREE.Vector3(0, 1, 0)
    const screenX = new THREE.Vector3().crossVectors(worldUp, viewAxis).normalize()
    const fn = new THREE.Vector3(...normal)
    const align = new THREE.Quaternion().setFromUnitVectors(fn, viewAxis)
    const clock = new THREE.Quaternion().setFromAxisAngle(viewAxis, THREE.MathUtils.degToRad(clockDeg))
    const tilt = new THREE.Quaternion().setFromAxisAngle(screenX, THREE.MathUtils.degToRad(tiltDeg))
    // clock appliqué après align (même axe que la normale alignée) — ne change pas la face visible.
    // tilt appliqué en dernier, autour de l'axe X écran — dévie volontairement la face de la caméra.
    meshRef.current.quaternion.copy(tilt.multiply(clock.multiply(align)))
  }, [normal, clockDeg, tiltDeg, camera])

  return (
    <group scale={520}>
      <mesh ref={meshRef} geometry={geometry} material={material} />
    </group>
  )
}
