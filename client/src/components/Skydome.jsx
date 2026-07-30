import * as THREE from 'three'
import { GradientTexture, Sparkles } from '@react-three/drei'
import { SKYDOME_PRESETS } from '../lib/skydomePresets.js'

// Skydome — dôme de fond animé, purement visuel (aucune collision, aucune donnée de
// `surface_data` : .claude/rules/world.md, "le rendu ne redéfinit pas le modèle canonique").
// Catalogue des ambiances : `lib/skydomePresets.js`.
const DOME_RADIUS = 300
// Plan de "sol" ambiant sous la grille — comble le vide entre les salles construites, pas un
// remplacement du sol réel d'une salle (qui reste porté par `surface_data`, rendu par-dessus).
const GROUND_RADIUS = DOME_RADIUS * 0.6
const GROUND_Y = -0.05

export default function Skydome({ preset = 'ocean_floor' }) {
  const config = SKYDOME_PRESETS[preset] || SKYDOME_PRESETS.ocean_floor
  return (
    <>
      <fogExp2 attach="fog" args={[config.fogColor, config.fogDensity]} />
      <mesh>
        <sphereGeometry args={[DOME_RADIUS, 32, 32]} />
        <meshBasicMaterial side={THREE.BackSide} depthWrite={false} fog={false}>
          <GradientTexture stops={[0, 0.5, 1]} colors={config.domeColors} size={512} />
        </meshBasicMaterial>
      </mesh>
      <mesh position={[0, GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[GROUND_RADIUS, 48]} />
        <meshBasicMaterial>
          <GradientTexture
            type="radial"
            stops={[0, 1]}
            colors={[config.groundColorCenter, config.groundColorEdge]}
            size={512}
            width={512}
          />
        </meshBasicMaterial>
      </mesh>
      <Sparkles
        count={config.particleCount}
        speed={config.particleSpeed}
        size={config.particleSize}
        color={config.particleColor}
        scale={[DOME_RADIUS * 0.4, DOME_RADIUS * 0.2, DOME_RADIUS * 0.4]}
        opacity={0.5}
      />
    </>
  )
}
