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
// de sa case, `color` passé par l'appelant via `getCombatPathColor`).
// COMBAT-PATHCOLOR-RELIEF-HIDDEN (2026-10-10) — un sol à relief réel (`realRelief`, jusqu'à ±0.12 m de
// déplacement géométrique, `client/src/lib/reliefGeometry.js`) peut dépasser localement la hauteur du
// réticule et le recouvrir complètement : invisible sur toute carte au sol suffisamment accidenté,
// quel que soit le rôle (confirmé avec un token MJ sur la même salle). C'est un survol de gameplay, pas
// un objet physique du décor — `depthTest={false}` le fait toujours dessiner par-dessus le sol, quel
// que soit son relief, comme les autres survols de combat de ce fichier/`Canvas3D.jsx`. `renderOrder`
// fixe l'ordre entre éléments eux-mêmes non testés par profondeur (sans quoi l'ordre de scène déciderait
// arbitrairement). +0.02 de hauteur conservé par cohérence visuelle (évite que le réticule semble à
// fleur de sol une fois qu'il n'est plus masqué), mais ne conditionne plus sa visibilité.
export function GroundCursorReticule({ position, color = '#ffffff' }) {
  const texture = useTexture('/assets/RETICULE_CASE.svg')
  const liftedPosition = position ? [position[0], position[1] + 0.02, position[2]] : position
  return (
    <mesh position={liftedPosition} rotation={[-Math.PI / 2, 0, 0]} renderOrder={50}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} color={color} transparent depthWrite={false} depthTest={false} />
    </mesh>
  )
}
