import { useMemo, useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import DiceMesh from './DiceMesh.jsx'
import { decomposeDice, calcLanePositions } from '../lib/diceMath.js'

// ─── DiceRoller ───────────────────────────────────────────────────────────────
// Orchestrateur R3F — monté directement dans <Scene> de Canvas3D.
// Reçoit le payload DICE_RESULT, décompose en dés individuels,
// calcule les lanes, monte les DiceMesh.
// Un plan invisible couvre l'écran — le clic n'importe où appelle onDone().
//
// Props :
//   payload : { rolls, dieType, seed, timestamp } depuis DICE_RESULT
//   onDone  : callback → SessionPage remet lastDiceRoll à null
export default function DiceRoller({ payload, onDone }) {
  const { camera } = useThree()
  const startTime = useRef(performance.now())

  const { rolls, dieType, seed, color } = payload

  // Décomposition du payload en dés individuels
  const dice = useMemo(
    () => decomposeDice(rolls, dieType, seed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload]
  )

  // Calcul des positions de lanes
  const lanePositions = useMemo(
    () => calcLanePositions(dice.length),
    [dice.length]
  )

  // Plan invisible plein écran pour capturer le clic "fermer"
  // Positionné devant la caméra, plus loin que les dés (distance 8 vs 6 pour les dés)
  // e.stopPropagation() — ne pas propager au canvas (évite interactions scene)
  const handleClick = (e) => {
    e.stopPropagation()
    onDone?.()
  }

  // Plan géant centré sur la caméra — intercepte tous les clics
  // Taille 200×200 unités → couvre n'importe quel angle de caméra
  // Transparent (opacity 0) mais visible au raycaster
  const planeMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    side: THREE.FrontSide,
    depthWrite: false,
  }), [])

  const planeRef = useRef()

  // Mise à jour position plan à chaque frame pour suivre la caméra
  // Utilisation de useEffect + requestAnimationFrame plutôt que useFrame
  // car le plan ne fait pas partie de la scène animée des dés
  useEffect(() => {
    let rafId
    const update = () => {
      if (!planeRef.current) return
      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)
      const pos = camera.position.clone().add(dir.multiplyScalar(8))
      planeRef.current.position.copy(pos)
      planeRef.current.lookAt(camera.position)
      rafId = requestAnimationFrame(update)
    }
    rafId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(rafId)
  }, [camera])

  return (
    <>
      {/* Plan invisible cliquable — ferme l'overlay au clic */}
      <mesh
        ref={planeRef}
        material={planeMaterial}
        onClick={handleClick}
      >
        <planeGeometry args={[200, 200]} />
      </mesh>

      {/* Lumière ambiante renforcée pour les dés */}
      <ambientLight intensity={0.4} color="#a0c0ff" />

      {/* Dés */}
      {dice.map((die, i) => (
        <DiceMesh
          key={`${die.dieType}-${i}-${payload.timestamp}`}
          dieType={die.dieType}
          faceValue={die.faceValue}
          seed={die.seed}
          laneX={lanePositions[i]}
          startTime={startTime.current}
          color={color}
        />
      ))}
    </>
  )
}
