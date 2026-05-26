import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  getFaceQuaternion, // NOUVEAU: Récupère la rotation codée en dur depuis FACE_ROTATIONS
  getFinalRotation,  // Sert toujours pour la rotation chaotique de départ
  makeNoiseFunc,
  getAnimDuration,
  PHASES,
  easeOut,
  easeInOut,
} from '../lib/diceMath.js'

// ─── Mapping des modèles 3D ──────────────────────────────────────────────────
// À adapter selon l'arborescence réelle de ton dossier public
const GLB_PATHS = {
  d4: '/models/D4.glb',
  d6: '/models/D6.glb',
  d8: '/models/D8.glb',
  d10: '/models/D10.glb',
  d10_units: '/models/D10.glb',
  d10_tens: '/models/D100.glb', // On suppose que le fichier des dizaines s'appelle D100.glb
  d12: '/models/D12.glb',
  d20: '/models/D20.glb',
}

// Préchargement des assets pour éviter les pop-ins au premier lancer
Object.values(GLB_PATHS).forEach(path => useGLTF.preload(path))

// ─── Fonction utilitaire pseudo-aléatoire pour la variabilité ────────────────
// Génère un float entre -1 et 1 basé sur la seed
function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// ─── DiceMesh ─────────────────────────────────────────────────────────────────
export default function DiceMesh({ dieType, faceValue, seed, laneX }) {
  const { camera } = useThree()
  const groupRef = useRef()
  const meshRef  = useRef()
  const elapsed  = useRef(0)
  const done     = useRef(false)

  // 1. Chargement du modèle .glb correspondant au type de dé
  const modelPath = GLB_PATHS[dieType] || GLB_PATHS.d6
  const { nodes, materials } = useGLTF(modelPath)

  // 2. Extraction dynamique du premier mesh et matériau trouvé dans le GLB
  // Cela évite de hardcoder le nom du mesh s'il varie ("Cube", "D20", etc.)
  const { geometry, material } = useMemo(() => {
    const meshNode = Object.values(nodes).find(n => n.isMesh)
    return {
      geometry: meshNode ? meshNode.geometry : new THREE.BoxGeometry(1, 1, 1),
      material: meshNode ? meshNode.material : new THREE.MeshStandardMaterial(),
    }
  }, [nodes])

  // 3. Calculs déterministes d'animation
  const noise = useMemo(() => makeNoiseFunc(seed), [seed])
  
  // Durée de base + variabilité de ±20% déterministe
  const duration = useMemo(() => {
    const baseDuration = getAnimDuration(seed)
    const variability = 0.8 + (seededRandom(seed) * 0.4) // donne entre 0.8 et 1.2
    return baseDuration * variability
  }, [seed])

  // Quaternion de départ (chaotique)
  const startQ = useMemo(() => {
    const r = getFinalRotation(seed ^ 0xDEAD)
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(r.rx, r.ry, r.rz))
  }, [seed])

  // Quaternion cible absolu (face value hardcodée) orienté vers la caméra
  const targetQ = useMemo(() => {
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    
    // On récupère le quaternion qui met la face en haut (depuis diceMath.js)
    const faceLocalQuat = getFaceQuaternion(dieType, faceValue)
    
    if (!faceLocalQuat) {
      // Fallback de sécurité si le mapping est manquant
      const r = getFinalRotation(seed)
      return new THREE.Quaternion().setFromEuler(new THREE.Euler(r.rx, r.ry, r.rz))
    }

    // On combine la rotation de la face avec l'orientation de la caméra
    // pour que la face cible regarde toujours la caméra, peu importe l'angle.
    const lookAtQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), // Axe "Haut" par défaut
      camDir.clone().negate()
    )
    
    return lookAtQuat.multiply(faceLocalQuat)
  }, [dieType, faceValue, camera, seed])

  // 4. Boucle d'animation (useFrame)
  useFrame((_, delta) => {
    if (!groupRef.current || !meshRef.current || done.current) return

    elapsed.current += delta
    const t = Math.min(elapsed.current / duration, 1)

    // ── Position (Lanes & Trajectoire parabolique) ──
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    const camPos = camera.position.clone()
    const up    = new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(camDir, up).normalize()

    // Calcul du couloir
    const basePos = camPos.clone()
      .add(camDir.clone().multiplyScalar(6))
      .add(right.clone().multiplyScalar(laneX))
      .add(up.clone().multiplyScalar(0.5))

    let posY = basePos.y
    if (t < PHASES.BOUNCE_END) {
      const tp = t / PHASES.BOUNCE_END
      posY += Math.sin(tp * Math.PI) * 2.0 // Grand arc parabolique
    } else if (t < PHASES.ALIGN_END) {
      const tp = (t - PHASES.BOUNCE_END) / (PHASES.ALIGN_END - PHASES.BOUNCE_END)
      posY += Math.sin(tp * Math.PI) * 0.4 // Petit rebond d'alignement
    } else {
      const tp = (t - PHASES.ALIGN_END) / (1 - PHASES.ALIGN_END)
      posY += Math.sin(tp * Math.PI * 4) * 0.06 * (1 - tp) // Wobble de stabilisation
    }

    groupRef.current.position.set(basePos.x, posY, basePos.z)

    // ── Rotation (Interpolation Slerp + Noise) ──
    const noiseInfluence = t < PHASES.BOUNCE_END
      ? 1.0
      : t < PHASES.ALIGN_END
        ? 1.0 - easeOut((t - PHASES.BOUNCE_END) / (PHASES.ALIGN_END - PHASES.BOUNCE_END))
        : 0.0

    const alignT = t < PHASES.BOUNCE_END ? 0 : easeInOut(
      Math.min((t - PHASES.BOUNCE_END) / (PHASES.ALIGN_END - PHASES.BOUNCE_END), 1)
    )

    const currentQ = new THREE.Quaternion()
    currentQ.slerpQuaternions(startQ, targetQ, alignT)

    const n = noise(elapsed.current * 6)
    const noiseQ = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        n.dx * noiseInfluence,
        n.dy * noiseInfluence,
        n.dz * noiseInfluence,
      )
    )
    
    meshRef.current.quaternion.copy(currentQ.multiply(noiseQ))

    // ── Finalisation ──
    if (t >= 1) {
      groupRef.current.position.set(basePos.x, basePos.y, basePos.z)
      meshRef.current.quaternion.copy(targetQ)
      done.current = true
    }
  })

  return (
    <group ref={groupRef}>
      <mesh 
        ref={meshRef} 
        geometry={geometry} 
        material={material} 
        castShadow 
      />
    </group>
  )
}