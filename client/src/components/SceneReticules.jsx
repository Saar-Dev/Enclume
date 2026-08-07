import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, useTexture } from '@react-three/drei'

// Réticules 3D (textures Three.js) — extraites de Canvas3D.jsx (Saar 2026-08-07) pour lui retirer la
// responsabilité curseurs/réticules. Aucun changement de comportement, seuls les assets changent :
// RETICULE_CIBLE.svg / RETICULE_CASE.svg remplacent reticule2.svg / reticule.svg (supprimés).
// Les deux nouveaux SVG sont forcés en #ffffff explicite (pas currentColor) — chargés hors DOM comme
// texture bitmap, currentColor y résoudrait en noir (valeur initiale CSS) et empêcherait la teinte
// dynamique (material.color, multiplication blanc × couleur).

// Réticule de ciblage — remplace l'anneau plein pour le survol "attaquable" (retour Saar 2026-08-01).
// Couleur #D94A4A choisie parmi les 4 proposées — rouge, convention "cible hostile" déjà utilisée par
// l'ancien anneau. Pulsation : même patron que TokenRing (isSelected) — échelle + opacité oscillantes
// via useFrame. Hauteur : 1.5 puis +25% (retour Saar 2026-08-01, deux passes). Billboard = toujours
// face caméra. useTexture suspend le chargement.
export function TargetReticule({ color = '#D94A4A', opacity = 1 }) {
  const texture = useTexture('/assets/RETICULE_CIBLE.svg')
  const meshRef = useRef()
  const materialRef = useRef()
  const t = useRef(0)
  useFrame((_, delta) => {
    t.current += delta
    const time = t.current
    const s = 1 + Math.sin(time * 2.5) * 0.08
    if (meshRef.current) meshRef.current.scale.set(s, s, 1)
    if (materialRef.current) materialRef.current.opacity = opacity * (0.75 + Math.sin(time * 4) * 0.25)
  })
  return (
    <Billboard position={[0, 0.9, 0]}>
      <mesh ref={meshRef}>
        <planeGeometry args={[1.3 * 1.15 * 1.1, 1.3 * 1.5 * 1.25 * 1.1]} />
        <meshBasicMaterial ref={materialRef} map={texture} color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
    </Billboard>
  )
}

// Réticule à plat au sol — une par case du chemin de déplacement combat (retour Saar 2026-08-07 :
// remplace les cases pleines colorées par allure — le réticule prend directement la couleur d'allure
// de sa case, `color` passé par l'appelant via `getCombatPathColor`). +0.02 de hauteur pour éviter le
// z-fighting avec le sol.
export function GroundCursorReticule({ position, color = '#ffffff' }) {
  const texture = useTexture('/assets/RETICULE_CASE.svg')
  const liftedPosition = position ? [position[0], position[1] + 0.02, position[2]] : position
  return (
    <mesh position={liftedPosition} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} color={color} transparent depthWrite={false} />
    </mesh>
  )
}
