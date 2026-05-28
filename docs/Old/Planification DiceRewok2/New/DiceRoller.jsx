import { useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import DiceMesh from './DiceMesh.jsx'
import { decomposeDice, calcLanePositions } from '../lib/diceMath.js'

// ─── DiceRoller ───────────────────────────────────────────────────────────────
// Orchestrateur R3F — monté directement dans <Scene> de Canvas3D.
// Reçoit le payload DICE_RESULT, décompose en dés individuels,
// calcule les lanes, et instancie les DiceMesh basés sur les fichiers .glb.
// Un plan invisible couvre l'écran — le clic n'importe où appelle onDone().
//
// Props :
//   payload : { rolls, dieType, seed, timestamp } depuis DICE_RESULT
//   onDone  : callback → SessionPage remet lastDiceRoll à null
export default function DiceRoller({ payload, onDone }) {
  const { camera } = useThree()
  const planeRef = useRef()

  const { rolls, dieType, seed } = payload

  // 1. Décomposition du payload en dés individuels (limité à 6 max)
  const dice = useMemo(
    () => decomposeDice(rolls, dieType, seed),
    [payload]
  )

  // 2. Calcul des positions des couloirs (Lanes) pour éviter les collisions visuelles
  const lanePositions = useMemo(
    () => calcLanePositions(dice.length),
    [dice.length]
  )

  // 3. Gestion de la fermeture de l'overlay au clic utilisateur
  const handleClick = (e) => {
    e.stopPropagation() // Évite de propager l'interaction aux éléments 3D en arrière-plan
    onDone?.()
  }

  // Plan géant transparent (opacity 0) mais réactif au raycaster pour intercepter les clics
  const planeMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    side: THREE.FrontSide,
    depthWrite: false,
  }), [])

  // 4. Synchronisation du plan invisible avec la caméra à chaque frame
  useFrame(() => {
    if (!planeRef.current) return
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    
    // Positionne le plan à une distance de 8 (les dés s'animent à une distance de 6)
    const pos = camera.position.clone().add(dir.multiplyScalar(8))
    planeRef.current.position.copy(pos)
    planeRef.current.lookAt(camera.position)
  })

  return (
    <>
      {/* Plan invisible plein écran pour capturer le clic de fermeture */}
      <mesh
        ref={planeRef}
        material={planeMaterial}
        onClick={handleClick}
      >
        <planeGeometry args={[200, 200]} />
      </mesh>

      {/* Éclairage d'ambiance optimisé pour la mise en valeur des modèles .glb */}
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />

      {/* Rendu des dés individuels dans leurs couloirs respectifs */}
      {dice.map((die, i) => (
        <DiceMesh
          key={`${die.dieType}-${i}-${payload.timestamp}`} // Force le remount immédiat à chaque nouveau jet
          dieType={die.dieType}
          faceValue={die.faceValue}
          seed={die.seed}
          laneX={lanePositions[i]}
        />
      ))}
    </>
  )
}