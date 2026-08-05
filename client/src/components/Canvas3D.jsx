import { useRef, useState, useEffect, useCallback, useMemo, Component } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { MapControls, Grid, Text, Billboard, useTexture } from '@react-three/drei'
import { useGLTF } from '@react-three/drei'
import { useTranslation } from 'react-i18next'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import api from '../lib/api.js'
import { getCombatPathColor, selectCombatMovementForCost } from '../../../shared/combatMovement.js'
import { WS } from '../../../shared/events.js'
import { loadVoxelTextures } from '../lib/voxelTextures.js'
import { useCameraLOS } from '../lib/useCameraLOS.js'
import CulledVoxelScene from './CulledVoxelScene.jsx'
import DungeonTerrainScene from './DungeonTerrainScene.jsx'
import SurfaceDungeonScene from './SurfaceDungeonScene.jsx'
import Skydome from './Skydome.jsx'
import SurfaceConnectorPanel from './SurfaceConnectorPanel.jsx'
import EntityMesh from './EntityMesh.jsx'
import DiceRoller from './DiceRoller.jsx'
import { FONT_URL, TokenLabel, TokenGmBadge, TokenStatusBadges } from './TokenPresentation.jsx'
import {
  computeSurfaceGridExtent,
  hasSurfaceContent,
  isWorldPointVisibleAtLevel,
  levelToY,
  normalizeSurfaceData,
  surfaceTextureIds,
} from '../lib/surfaceData.js'
import { useTokenStore } from '../stores/tokenStore'
import { useCharacterStore } from '../stores/characterStore'
import { useAuthStore } from '../stores/authStore'
import { useMapStore } from '../stores/mapStore'
import { useEntityStore } from '../stores/entityStore'
import { useSessionStore } from '../stores/sessionStore'
import { useCombatStore } from '../stores/combatStore'

// ─── Constantes ───────────────────────────────────────────────────────────────
const GRID_SIZE = 50
const HARDCODED_DEFAULT_TOKEN_URL = '/models/default.glb'
const USE_DIORAMA_TERRAIN = true

// Seuil en pixels pour distinguer clic court (sélection) de drag
const DRAG_THRESHOLD = 4

// Offset visuel du token au-dessus du sol pendant le drag
const DRAG_HOVER = 0.5

// Amplitude max de l'inclinaison pendant le drag (radians)
const DRAG_TILT_MAX = 0.3
const THIRD_PERSON_MIN_DISTANCE = 2.2
const THIRD_PERSON_MAX_DISTANCE = 12
const THIRD_PERSON_ROTATE_SPEED = 0.008
const THIRD_PERSON_PITCH_SPEED = 0.006
const THIRD_PERSON_MIN_PITCH = 0.12
const THIRD_PERSON_MAX_PITCH = 1.15

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor
}

function yawToTokenRotation(yaw) {
  return mod(Math.round((yaw + Math.PI) / (Math.PI / 4)), 8)
}


// ─── Utilitaire coordonnées ───────────────────────────────────────────────────
// Un token canonique stocke directement le point de contact de ses pieds dans le monde.
// Les anciens tokens conservent leur décalage visuel historique tant qu'un MJ ne les replace pas.
function tokenFeetPoint(token) {
  const legacyOffset = token?.position_space === 'world-feet' ? 0 : 0.5
  return {
    x: (Number(token?.pos_x) || 0) + legacyOffset,
    y: (Number(token?.pos_z) || 0) + legacyOffset,
    z: (Number(token?.pos_y) || 0) + legacyOffset,
  }
}

// Hauteur réelle du sommet d'un voxel en Three.js Y selon sa géométrie.
// Utilisée pour poser les tokens exactement sur la surface (pas dans le vide).
function getVoxelSurfaceTop(v) {
  if (v.geo === 'slab_bottom') return v.y + 0.5  // dalle basse : sommet à mi-case
  return v.y + 1.0                                 // cube, slab_top, autres : sommet en haut de case
}

// ─── Disque combat actif ─────────────────────────────────────────────────────
function TokenActiveDisk({ isActive }) {
  const diskRef = useRef()
  const t = useRef(0)
  useFrame((_, delta) => {
    if (!diskRef.current || !isActive) return
    t.current += delta
    diskRef.current.material.opacity = 0.6 + Math.sin(t.current * 3) * 0.3
    const s = 1 + Math.sin(t.current * 2) * 0.06
    diskRef.current.scale.set(s, 1, s)
  })
  if (!isActive) return null
  return (
    <mesh ref={diskRef} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.52, 0.72, 48]} />
      <meshBasicMaterial color="#ffd700" transparent opacity={0.6} depthWrite={false} />
    </mesh>
  )
}

// ─── Anneau de base du token ──────────────────────────────────────────────────
function TokenRing({ color, isSelected, opacity }) {
  const ringRef = useRef()
  const t = useRef(0)

  // baseY était calibré pour un corps flottant à Y_OFFSET=0.5 (0.6 ≈ ce flottement + 0.1 au sol) —
  // le corps est maintenant à 0 (retour Saar 2026-08-01), donc l'anneau reste toujours près du sol,
  // plus de distinction dragging/non-dragging nécessaire (les deux convergeaient déjà vers ~0.1).
  const baseY = 0.1
  const baseOpacity = opacity ?? 0.5

  useFrame((_, delta) => {
    if (!ringRef.current) return
    if (!isSelected) {
      ringRef.current.position.y = baseY
      ringRef.current.scale.setScalar(1)
      ringRef.current.material.opacity = baseOpacity
      return
    }
    t.current += delta
    const time = t.current
    ringRef.current.position.y = baseY + Math.sin(time * 3) * 0.05
    const s = 1 + Math.sin(time * 2.5) * 0.08
    ringRef.current.scale.set(s, 1, s)
    ringRef.current.material.opacity = baseOpacity + Math.sin(time * 4) * 0.25 * (baseOpacity / 0.5)
  })

  return (
    <mesh ref={ringRef} position={[0, baseY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.58, 48]} />
      <meshBasicMaterial color={color} transparent opacity={baseOpacity} depthWrite={false} />
    </mesh>
  )
}

// ─── Token individuel ─────────────────────────────────────────────────────────
const Y_OFFSET = 0

// Filet de sécurité : si useGLTF échoue (404, GLB invalide, etc.), rend la capsule
// au lieu de noircir le canvas entier. La capsule est le dernier recours, pas le fallback normal.
class TokenGlbErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      const { color, isGmLayer, tiltX, tiltZ, sceneOpacity } = this.props
      return <TokenFallbackBody color={color} isGmLayer={isGmLayer} tiltX={tiltX} tiltZ={tiltZ} sceneOpacity={sceneOpacity} />
    }
    return this.props.children
  }
}

// Corps GLB — appelé uniquement quand glbUrl est défini.
// useGLTF suspend le composant le temps du chargement (géré nativement par Canvas R3F).
// useGLTF met en cache par URL — plusieurs tokens partageant la même URL ne téléchargent qu'une fois.
function TokenGlbBody({ glbUrl, isGmLayer, tiltX, tiltZ, sceneOpacity = 1 }) {
  const { scene: gltfScene } = useGLTF(glbUrl)

  const clonedScene = useMemo(() => {
    if (!gltfScene) return null
    const clone = SkeletonUtils.clone(gltfScene)
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        // Cloner les materiaux AVANT toute mutation — partagés par référence entre tous les clones
        // du même gltfScene. Sans clone, muter opacity sur un token GM corrompt les autres.
        const cloneMat = (mat) => {
          const m = mat.clone()
          if (m.map) {
            m.map.colorSpace = THREE.SRGBColorSpace
            m.map.needsUpdate = true
          }
          const opacity = sceneOpacity * (isGmLayer ? 0.5 : 1)
          if (opacity < 0.999) {
            m.transparent = true
            m.opacity = opacity
            m.depthWrite = false
          }
          m.needsUpdate = true
          return m
        }
        if (Array.isArray(child.material)) {
          child.material = child.material.map(cloneMat)
        } else {
          child.material = cloneMat(child.material)
        }
      }
    })
    return clone
  }, [gltfScene, isGmLayer, sceneOpacity])

  if (!clonedScene) return null

  return (
    <primitive
      object={clonedScene}
      position={[0, Y_OFFSET, 0]}
      scale={[1, 1, 1]}
      rotation={[tiltX, 0, tiltZ]}
    />
  )
}

// Corps fallback — silhouette capsule colorée, aucun appel réseau.
// Rendu quand le personnage n'a pas de glb_url et qu'aucun token par défaut de campagne n'est défini.
function TokenFallbackBody({ color, isGmLayer, tiltX, tiltZ, sceneOpacity = 1 }) {
  return (
    <group position={[0, Y_OFFSET, 0]} rotation={[tiltX, 0, tiltZ]}>
      <mesh position={[0, 0.8, 0]}>
        <capsuleGeometry args={[0.28, 1.0, 4, 8]} />
        <meshLambertMaterial
          color={color}
          transparent={isGmLayer || sceneOpacity < 0.999}
          opacity={sceneOpacity * (isGmLayer ? 0.5 : 1)}
          depthWrite={sceneOpacity >= 0.999}
        />
      </mesh>
    </group>
  )
}

// Réticule de ciblage — remplace l'anneau plein pour le survol "attaquable" (retour Saar 2026-08-01).
// client/public/assets/reticule2.svg (coins ouverts, dédié au ciblage — le déplacement est revenu aux
// cases pleines/fil de fer d'origine, cf. plus bas dans ce fichier : tuilé sur plusieurs cases, le
// réticule donnait un rendu confus). Trait forcé en blanc dans le SVG (au lieu de currentColor
// d'origine) : chargé comme texture bitmap standard hors DOM, currentColor s'y résoudrait en noir
// (valeur initiale CSS) et empêcherait la teinte dynamique ci-dessous (material.color, multiplication
// blanc × couleur). Couleur #D94A4A choisie parmi les 4 proposées — rouge, convention "cible hostile"
// déjà utilisée par l'ancien anneau. Pulsation : même patron que TokenRing (isSelected) juste
// au-dessus — échelle + opacité oscillantes via useFrame. Hauteur : 1.5 puis +25% (retour Saar
// 2026-08-01, deux passes). Billboard = toujours face caméra. useTexture suspend le chargement.
function TargetReticule({ color = '#D94A4A', opacity = 1 }) {
  const texture = useTexture('/assets/reticule2.svg')
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

// Réticule à plat au sol — case survolée en mode déplacement UNIQUEMENT (retour Saar 2026-08-01 :
// remplace le curseur fil de fer, mais seulement lui — jamais le chemin à plusieurs cases, source du
// rendu confus précédent avec une seule instance à la fois, pas de risque de superposition). Version
// volontairement simple (pas de halo/ombre cette fois — jamais isolé/validé séparément avant le
// retour en arrière global) : +0.02 de hauteur gardé (change rien de risqué), le reste peut être
// rajouté séparément si voulu une fois cette base confirmée.
function GroundCursorReticule({ position }) {
  const texture = useTexture('/assets/reticule.svg')
  const liftedPosition = position ? [position[0], position[1] + 0.02, position[2]] : position
  return (
    <mesh position={liftedPosition} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} color="#ffffff" transparent depthWrite={false} />
    </mesh>
  )
}

// Token individuel — gère drag, lerp, ring, label.
// glbUrl : URL complète du GLB à charger (character.glb_url ou default_token_glb_url de campagne), ou null.
// Si null → TokenFallbackBody (silhouette géométrique). Si défini → TokenGlbBody (modèle 3D).
function TokenMesh({ token, glbUrl, isSelected, isActive, onDragStart, dragState, isGmLayer, sceneOpacity = 1, statusEffectsMode = 'enforced', isAmbientTargetHover = false }) {
  const color = token.user_color || token.color || '#4A90D9'
  const label = token.label || '?'

  const feet = tokenFeetPoint(token)

  const isDragging = dragState !== null
  const x = isDragging ? dragState.x : feet.x
  const y = isDragging ? dragState.y : feet.y
  const z = isDragging ? dragState.z : feet.z

  const tiltX = isDragging ? dragState.tiltX : 0
  const tiltZ = isDragging ? dragState.tiltZ : 0

  // PE21 : rotation.y = r * Math.PI / 4 — 8 orientations, incréments 45°
  // Appliqué sur le <group> parent — indépendant du tilt de drag (sur le corps)
  const rotationY = (token.r ?? 0) * Math.PI / 4

  // ── Lerp 300ms — P40 : position via ref, jamais via state dans useFrame ──
  const groupRef = useRef()
  const lerpPos = useRef({ ...feet })
  const targetRef = useRef({ x, y, z })
  targetRef.current = { x, y, z }
  const isDraggingRef = useRef(isDragging)
  isDraggingRef.current = isDragging

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (isDraggingRef.current) {
      groupRef.current.position.set(targetRef.current.x, targetRef.current.y, targetRef.current.z)
      lerpPos.current.x = targetRef.current.x
      lerpPos.current.y = targetRef.current.y
      lerpPos.current.z = targetRef.current.z
    } else {
      const alpha = 1 - Math.exp(-delta / 0.1)
      lerpPos.current.x += (targetRef.current.x - lerpPos.current.x) * alpha
      lerpPos.current.y += (targetRef.current.y - lerpPos.current.y) * alpha
      lerpPos.current.z += (targetRef.current.z - lerpPos.current.z) * alpha
      groupRef.current.position.set(lerpPos.current.x, lerpPos.current.y, lerpPos.current.z)
    }
  })

  return (
    // rotation.y permanent sur le group — PE21
    // position pilotée par useFrame (Lerp) — jamais via prop JSX
    <group
      ref={groupRef}
      rotation={[0, rotationY, 0]}
      userData={{ isToken: true, tokenId: token.id }}
      onPointerDown={(e) => {
        if (sceneOpacity < 0.999) return
        e.stopPropagation()
        onDragStart(e, token)
      }}
    >
      <TokenActiveDisk isActive={isActive} />
      <TokenRing color={color} isSelected={isSelected} opacity={sceneOpacity * (isGmLayer ? 0.25 : 0.5)} />
      {/* Anneau ciblage — la case de ce token est survolée pendant le mode déplacement ambiant (curseur
          "attaquable" façon XCOM 2, retour Saar 2026-07-31). Détection par case dans handlePointerMove
          (occupation, pas un hit du mesh) — isAmbientTargetHover reçu du parent, jamais recalculé ici. */}
      {isAmbientTargetHover && <TargetReticule opacity={sceneOpacity} />}
      <TokenGlbErrorBoundary key={glbUrl} color={color} isGmLayer={isGmLayer} tiltX={tiltX} tiltZ={tiltZ} sceneOpacity={sceneOpacity}>
        <TokenGlbBody glbUrl={glbUrl} isGmLayer={isGmLayer} tiltX={tiltX} tiltZ={tiltZ} sceneOpacity={sceneOpacity} />
      </TokenGlbErrorBoundary>
      <TokenLabel label={label} color={color} isGmLayer={isGmLayer} />
      {isGmLayer && <TokenGmBadge />}
      <TokenStatusBadges statuses={token.statuses} statusEffectsMode={statusEffectsMode} />
    </group>
  )
}

// ─── Scène principale ─────────────────────────────────────────────────────────
// Lecture seule voxels + tokens + entités + WS listeners.
// La logique d'édition (pose, suppression, rotation) est dans Editor3D.
function ThirdPersonCamera({ token, enabled, onTokenSetRotation, updateToken }) {
  const { camera, gl } = useThree()
  const yawRef = useRef(Math.PI)
  const pitchRef = useRef(0.42)
  const distanceRef = useRef(6)
  const dragRef = useRef({ active: false, x: 0, y: 0 })
  const tokenRef = useRef(token)
  const lastRotationRef = useRef(null)

  useEffect(() => {
    tokenRef.current = token
    if (token?.id && lastRotationRef.current === null) {
      const r = Number(token.r) || 0
      yawRef.current = r * Math.PI / 4 - Math.PI
      lastRotationRef.current = r
    }
  }, [token])

  const applyTokenRotation = useCallback(() => {
    const currentToken = tokenRef.current
    if (!enabled || !currentToken) return
    const nextR = yawToTokenRotation(yawRef.current)
    if (nextR === lastRotationRef.current && nextR === (Number(currentToken.r) || 0)) return
    lastRotationRef.current = nextR
    updateToken?.({ id: currentToken.id, r: nextR })
    onTokenSetRotation?.(currentToken.id, nextR)
  }, [enabled, onTokenSetRotation, updateToken])

  useEffect(() => {
    if (!enabled) return undefined
    const canvas = gl.domElement

    const preventContextMenu = (e) => e.preventDefault()
    const handlePointerDown = (e) => {
      if (e.button !== 1 && e.button !== 2) return
      dragRef.current = { active: true, x: e.clientX, y: e.clientY }
      canvas.setPointerCapture?.(e.pointerId)
      e.preventDefault()
    }
    const handlePointerMove = (e) => {
      if (!dragRef.current.active) return
      const dx = e.clientX - dragRef.current.x
      const dy = e.clientY - dragRef.current.y
      dragRef.current = { active: true, x: e.clientX, y: e.clientY }
      yawRef.current -= dx * THIRD_PERSON_ROTATE_SPEED
      pitchRef.current = Math.max(
        THIRD_PERSON_MIN_PITCH,
        Math.min(THIRD_PERSON_MAX_PITCH, pitchRef.current + dy * THIRD_PERSON_PITCH_SPEED)
      )
      applyTokenRotation()
      e.preventDefault()
    }
    const handlePointerUp = (e) => {
      if (!dragRef.current.active) return
      dragRef.current.active = false
      canvas.releasePointerCapture?.(e.pointerId)
      e.preventDefault()
    }
    const handleWheel = (e) => {
      distanceRef.current = Math.max(
        THIRD_PERSON_MIN_DISTANCE,
        Math.min(THIRD_PERSON_MAX_DISTANCE, distanceRef.current + e.deltaY * 0.01)
      )
      e.preventDefault()
    }

    canvas.addEventListener('contextmenu', preventContextMenu)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('contextmenu', preventContextMenu)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerUp)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [enabled, gl, applyTokenRotation])

  useFrame(() => {
    if (!enabled || !tokenRef.current) return
    const currentToken = tokenRef.current
    const feet = tokenFeetPoint(currentToken)
    const target = new THREE.Vector3(feet.x, feet.y + 1.35, feet.z)
    const distance = distanceRef.current
    const pitch = pitchRef.current
    const horizontal = Math.cos(pitch) * distance
    const y = Math.sin(pitch) * distance
    const yaw = yawRef.current

    camera.position.set(
      target.x + Math.sin(yaw) * horizontal,
      target.y + y,
      target.z + Math.cos(yaw) * horizontal
    )
    camera.lookAt(target)
  })

  return null
}

function Scene({
  voxels, surfaceData, textureMaterials, entityTextureMaterials, runtimeEffectRegions, runtimeFeatureStates, socket, battlemapId,
  selectedSurfaceConnectorId, onSurfaceConnectorSelect,
  selectedTokenId, onTokenSelect,
  onTokenDoubleClick, justSelectedRef,
  altPressed, onEntityClick, onTokenSetRotation,
  moveTarget, onMoveCancel,
  dicePayload, onDiceDone,
  combatCameraCenter,
  combatMoveMode,
  pendingMoveSelection,
  combatTargetMode,
  onAmbientTokenClick,
  defaultTokenGlbUrl,
  losMode,
  onLosCancel,
  onLosResult,
  cameraMode,
  displayLevel = 0,
  statusEffectsMode = 'enforced',
  onCharacterDrop,
}) {
  const { t } = useTranslation()
  const { camera, gl, scene } = useThree()
  const orbitRef = useRef()
  const previousDisplayLevelRef = useRef(displayLevel)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  // Grille visuelle — grandit avec le sol construit, jamais au-delà de GRID_SIZE (garde-fou de
  // construction inchangé, cf. Editor3D.jsx). Purement cosmétique, aucun impact sur les limites de jeu.
  const visibleGridSize = useMemo(
    () => computeSurfaceGridExtent(surfaceData, { max: GRID_SIZE }),
    [surfaceData],
  )

  // Lecture des stores — pas de props pour ces données
  const { tokens, updateToken, removeToken } = useTokenStore()
  const { characters, isGm } = useCharacterStore()
  const { user } = useAuthStore()
  const { entities, blueprints, addEntity, removeEntity, updateEntity } = useEntityStore()
  const { phase, announcedActions, activeTokenId } = useCombatStore()

  const [dragState, setDragState] = useState(null)
  const [cameraVolumeRoomId, setCameraVolumeRoomId] = useState(null)
  const [freeCameraOverride, setFreeCameraOverride] = useState(false)

  useEffect(() => {
    const previousLevel = previousDisplayLevelRef.current
    previousDisplayLevelRef.current = displayLevel
    if (previousLevel === displayLevel || !orbitRef.current) return
    const deltaY = levelToY(displayLevel) - levelToY(previousLevel)
    const controls = orbitRef.current
    controls.object.position.y += deltaY
    controls.target.y += deltaY
    controls.update()
  }, [displayLevel])

  // ─── Mode visée déplacement — states + refs ───────────────────────────────
  // ghostPos/dotResult : states pour le rendu JSX du ghost
  // ghostRef : ref miroir pour lecture stable dans handlePointerUp (pattern P40)
  // tokensRef : ref miroir de tokens pour handlePointerMove stable (pattern P40)
  const [ghostPos, setGhostPos] = useState(null)   // null | { x, z } — coords base (PE14)
  const [dotResult, setDotResult] = useState(0)    // >0 push, <0 pull, =0 impossible
  const ghostRef = useRef({ ghostPos: null, dotResult: 0 })
  const tokensRef = useRef(tokens)
  tokensRef.current = tokens

  const followToken = useMemo(() => {
    const owned = tokens.find(token =>
      characters.some(character => character.id === token.character_id && character.user_id === user?.id)
    )
    if (owned) return owned
    if (selectedTokenId) return tokens.find(token => token.id === selectedTokenId) || null
    if (!isGm) return tokens.find(token => token.layer !== 'gm') || null
    return null
  }, [tokens, characters, user?.id, selectedTokenId, isGm])
  const thirdPersonCameraActive = cameraMode === 'play' && !!followToken && !freeCameraOverride

  // ─── Échap : sortir de la caméra troisième personne (token possédé, jamais désélectionnable) ──
  useEffect(() => {
    if (cameraMode !== 'play' || !followToken) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setFreeCameraOverride(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [cameraMode, followToken])

  // ─── Mode déplacement combat — P40 : ref miroir pour handlers stables ─────
  const combatMoveModeRef = useRef(null)
  combatMoveModeRef.current = combatMoveMode

  // ─── Mode sélection cible combat — P40 : ref miroir ───────────────────────
  const combatTargetModeRef = useRef(null)
  combatTargetModeRef.current = combatTargetMode

  // ─── Phase combat — P40 : ref miroir pour handleDragStart stable ──────────
  const combatPhaseRef = useRef(null)
  combatPhaseRef.current = phase

  // ─── Mode LOS — P40 : ref miroir ─────────────────────────────────────────
  const losModeRef = useRef(null)
  losModeRef.current = losMode

  // ─── Clic ambiant sur token adverse — P40 : ref miroir (COMBAT-CLICK-AUTOSOLVE) ──────────────
  const onAmbientTokenClickRef = useRef(null)
  onAmbientTokenClickRef.current = onAmbientTokenClick

  // ─── Chemin pathfinding combat (Sprint Pathfinding) ──────────────────────
  const [currentPath, setCurrentPath] = useState([])
  const currentPathRef = useRef([])
  currentPathRef.current = currentPath
  const previewRequestRef = useRef(0)

  const voxelsRef = useRef(voxels)
  voxelsRef.current = voxels

  // ─── LOS v2 — service complet (client/src/lib/useCameraLOS.js) ──────────
  // Déclaré après voxelsRef et tokensRef (TDZ — déclarations const non hoistées)
  const { losLine, onTokenClick, onPointerUp, clearLine } = useCameraLOS(
    losMode, orbitRef, tokensRef, battlemapId, onLosResult, onLosCancel
  )

  const lastCellRef = useRef(null)

  // Position curseur snappé (Three.js floor coords) — visible uniquement en mode combat
  const [combatCursorPos, setCombatCursorPos] = useState(null)

  // Token survolé pendant le mode déplacement ambiant — anneau "ciblage" (retour Saar 2026-07-31,
  // inspiré XCOM 2 : le curseur signale un clic-attaque plutôt qu'un clic-déplacement). Gardé ici
  // (pas de calcul LOS/distance au survol, juste un indicateur visuel local) — la mesure serveur
  // reste déclenchée uniquement au clic (useCombatClickAttack.js), décision déjà actée.
  const [ambientHoverTokenId, setAmbientHoverTokenId] = useState(null)
  // Ref miroir (P40) — lu dans handlePointerUp, écrit dans handlePointerMove uniquement.
  const hoveredOccupantTokenRef = useRef(null)

  // Nettoyage chemin + curseur quand on quitte le mode déplacement OU qu'un autre mode explicite
  // prend la priorité (ciblage/LOS/visée entité) — combatMoveMode reste non-null en arrière-plan
  // (survol ambiant, COMBAT-DEPLACEMENT-HOVER), sans ce garde le chemin/curseur resterait affiché
  // par-dessus le ciblage (retour Saar 2026-07-31).
  useEffect(() => {
    if (!combatMoveMode || combatTargetMode || losMode?.active || moveTarget) {
      setCombatCursorPos(null)
      setCurrentPath([])
      lastCellRef.current = null
      hoveredOccupantTokenRef.current = null
      setAmbientHoverTokenId(null)
    }
  }, [combatMoveMode, combatTargetMode, losMode, moveTarget])

  const dragRef = useRef({
    active: false,
    tokenId: null,
    token: null,
    startX: 0,
    startY: 0,
    hasMoved: false,
    prevWorldX: null,
    prevWorldZ: null,
  })

  // ─── Écoute entités temps réel ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    // ─── Écoute entités temps réel ───────────────────────────────────────
    const handleEntityCreated = ({ entity }) => addEntity(entity)
    const handleEntityDeleted = ({ entityId }) => removeEntity(entityId)
    const handleEntityUpdated = ({ entityId, current_state_id, state, updated_at, gm_only }) => {
      updateEntity({
        id: entityId,
        ...(current_state_id !== undefined && { current_state_id }),
        ...(state            !== undefined && { state }),
        ...(updated_at       !== undefined && { updated_at }),
        ...(gm_only          !== undefined && { gm_only }),
      })
      const { pendingEntityId, clearPendingEntityId } = useSessionStore.getState()
      if (pendingEntityId === entityId) clearPendingEntityId()
    }
    const handleEntityMoved = ({ entityId, pos_x, pos_y, pos_z, r, updated_at }) => {
      updateEntity({ id: entityId, pos_x, pos_y, pos_z, r, updated_at })
    }

    socket.on(WS.ENTITY_CREATED, handleEntityCreated)
    socket.on(WS.ENTITY_DELETED, handleEntityDeleted)
    socket.on(WS.ENTITY_UPDATED, handleEntityUpdated)
    socket.on(WS.ENTITY_MOVED, handleEntityMoved)

    return () => {
      socket.off(WS.ENTITY_CREATED, handleEntityCreated)
      socket.off(WS.ENTITY_DELETED, handleEntityDeleted)
      socket.off(WS.ENTITY_UPDATED, handleEntityUpdated)
      socket.off(WS.ENTITY_MOVED, handleEntityMoved)
    }
  }, [socket, battlemapId])

  const raycastGround = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const target = new THREE.Vector3()
    const hit = raycaster.ray.intersectPlane(groundPlane, target)
    return hit ? target : null
  }, [camera, gl])

  const raycastWorldSupport = useCallback((clientX, clientY) => {
    if (!hasSurfaceContent(surfaceData)) return null
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const normalMatrix = new THREE.Matrix3()
    for (const hit of raycaster.intersectObjects(scene.children, true)) {
      if (!hit.object?.userData?.worldSupport || !hit.face) continue
      normalMatrix.getNormalMatrix(hit.object.matrixWorld)
      const normal = hit.face.normal.clone().applyNormalMatrix(normalMatrix)
      if (normal.y < 0.5) continue
      return { x: hit.point.x, y: hit.point.y, z: hit.point.z }
    }
    return null
  }, [camera, gl, raycaster, scene, surfaceData])

  const requestWorldPathPreview = useCallback(async (mode, destination) => {
    const requestId = ++previewRequestRef.current
    try {
      const res = await api.post(`/battlemaps/${battlemapId}/world-path-preview`, {
        token_id: mode.tokenId,
        destination,
        budget_m: Number(mode.allures?.max) || 0,
      })
      if (requestId !== previewRequestRef.current) return
      const result = res.data?.result
      if (!result?.plan) {
        currentPathRef.current = []
        setCurrentPath([])
        return
      }
      let spentM = 0
      const path = [{ ...result.snappedFrom, spentM: 0 }]
      for (const segment of result.plan.segments) {
        spentM += Number(segment.costM) || 0
        path.push({
          ...segment.to,
          spentM,
          mode: segment.mode,
          partial: segment.partial,
          distanceM: Number(segment.distanceM) || 0,
          segmentCostM: Number(segment.costM) || 0,
          factor: Number(segment.factor) || 1,
        })
      }
      currentPathRef.current = path
      setCurrentPath(path)
    } catch (error) {
      if (requestId !== previewRequestRef.current) return
      currentPathRef.current = []
      setCurrentPath([])
      if (error?.response?.status !== 409) console.error('Erreur preview déplacement monde :', error)
    }
  }, [battlemapId])

  // Index colonne → hauteur réelle de surface (Three.js Y). Reconstruit uniquement quand voxels change.
  // O(1) par lookup vs O(N) par frame pour le getColumnTopY précédent.
  const colTopSurface = useMemo(() => {
    const map = {}
    for (const v of Object.values(voxels)) {
      const key = `${v.x}:${v.z}`
      const surf = getVoxelSurfaceTop(v)
      if (map[key] === undefined || surf > map[key]) map[key] = surf
    }
    return map
  }, [voxels])

  // Précédence unique du survol de déplacement ambiant — un seul point de vérité (COMBAT-
  // DEPLACEMENT-HOVER, 2026-07-31), consulté par handlePointerMove/handlePointerUp ci-dessous :
  // ciblage Attaque/CaC, LOS et visée entité passent toujours devant. handleDragStart n'en a pas
  // besoin (il vérifie déjà target/LOS avant sa propre garde combatMoveMode, par construction).
  // 3 vérifications indépendantes recopiées étaient la cause du bug initial (2 des 3 oubliées).
  const combatMoveHasPriority = useCallback(() =>
    !!combatMoveModeRef.current && !combatTargetModeRef.current && !losModeRef.current?.active && !moveTarget,
  [moveTarget])

  // Détection "case occupée par un autre token" — source unique, consultée au survol
  // (handlePointerMove) ET à nouveau, fraîche, au clic (handlePointerUp) — CLICKATTACK-MOVECONFLICT1 :
  // un déplacement ne doit jamais atterrir sur une case occupée, même si aucun `pointermove` n'a mis à
  // jour la détection sur cette position exacte juste avant le clic (ex. curseur immobile depuis avant
  // l'armement du survol). Tolérance 0,75 m = demi-case (`.claude/rules/world.md`).
  const findOccupantAt = useCallback((destination, excludeTokenId) =>
    tokensRef.current.find(t =>
      t.id !== excludeTokenId &&
      Math.abs(t.pos_x - destination.x) < 0.75 &&
      Math.abs(t.pos_y - destination.z) < 0.75
    ) ?? null,
  [])


  const handleDragStart = useCallback((e, token) => {
    e.stopPropagation()
    if (e.nativeEvent.button !== 0) return
    // Ciblage/LOS explicites d'abord — priorité sur le survol de déplacement ambiant (COMBAT-
    // DEPLACEMENT-HOVER, 2026-07-31) : ce dernier est désormais actif en permanence par défaut, il ne
    // doit jamais avaler un clic sur un token quand un mode explicite (Attaque/CaC/LOS) est en cours.
    if (combatTargetModeRef.current) {
      combatTargetModeRef.current.onPendingTarget(token.id, e.clientX, e.clientY)
      return
    }
    if (losModeRef.current?.active) {
      onTokenClick(token)
      return
    }
    // Survol ambiant actif — géré uniquement par handlePointerUp (case occupée, hoveredOccupantTokenRef)
    // pour couvrir tout clic dans la case du token, pas seulement un hit direct sur son mesh (retour
    // Saar 2026-07-31, docs/BUGIDENTIFIE.md COMBAT-CLICK-AUTOSOLVE). Ne rien faire ici évite un double
    // déclenchement (pointerdown ici + pointerup dans handlePointerUp pour le même clic).
    if (combatMoveModeRef.current) return
    clearLine()

    if (!isGm) {
      const character = characters.find(c => c.id === token.character_id)
      if (!character || character.user_id !== user?.id) return
    }
    dragRef.current = {
      active: true,
      tokenId: token.id,
      token,
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
      prevWorldX: null,
      prevWorldZ: null,
      destination: null,
    }
    if (orbitRef.current) orbitRef.current.enabled = false
  }, [isGm, user, characters, onTokenClick, clearLine])

  const handlePointerMove = useCallback((e) => {
    // ─── Mode déplacement combat — seulement si aucun mode explicite n'est prioritaire ─────────
    if (combatMoveHasPriority()) {
      const destination = raycastWorldSupport(e.clientX, e.clientY)
      if (!destination) return
      const mode = combatMoveModeRef.current
      // Une case occupée par un autre token n'est jamais une destination de déplacement — c'est une
      // interaction avec ce token à la place (retour Saar 2026-07-31 : "clic sur case sous token = pas
      // de déplacement, interaction avec le token" — un seul geste possible, jamais les deux forcés en
      // séquence). Détection par case (tolérance 0,75 m = demi-case, `.claude/rules/world.md`), pas par
      // hit du mesh du token — couvre tout clic dans la case, même si le modèle 3D ne la remplit pas
      // entièrement. Source unique pour la surbrillance ci-dessous ET le clic dans handlePointerUp
      // (hoveredOccupantTokenRef) — jamais un second système de détection en parallèle.
      const occupyingToken = findOccupantAt(destination, mode.tokenId)
      hoveredOccupantTokenRef.current = occupyingToken
      setAmbientHoverTokenId(prev => (prev === (occupyingToken?.id ?? null) ? prev : (occupyingToken?.id ?? null)))
      if (occupyingToken) {
        if (lastCellRef.current !== null) {
          lastCellRef.current = null
          setCombatCursorPos(null)
          currentPathRef.current = []
          setCurrentPath([])
        }
        return
      }
      const key = `${Math.round(destination.x * 4)}:${Math.round(destination.y * 4)}:${Math.round(destination.z * 4)}`
      if (key !== lastCellRef.current) {
        lastCellRef.current = key
        setCombatCursorPos(destination)
        void requestWorldPathPreview(mode, destination)
      }
      return
    }
    if (hoveredOccupantTokenRef.current) {
      hoveredOccupantTokenRef.current = null
      setAmbientHoverTokenId(null)
    }

    // ─── Mode visée entité — prioritaire sur le drag token ───────────────────
    if (moveTarget) {
      const worldPos = raycastGround(e.clientX, e.clientY)
      if (!worldPos) return

      // Snap 8 axes depuis la position de l'entité — contraint sur les axes exacts
      const dPosX = worldPos.x - moveTarget.entity.pos_x
      const dPosZ = worldPos.z - moveTarget.entity.pos_y  // pos_y base = Z Three.js (PE14)

      let snapX, snapZ
      if (Math.abs(dPosX) > 2 * Math.abs(dPosZ)) {
        // Axe X pur (orthogonal) — snapX contraint depuis entity.pos_x
        snapX = moveTarget.entity.pos_x + Math.round(dPosX)
        snapZ = moveTarget.entity.pos_y
      } else if (Math.abs(dPosZ) > 2 * Math.abs(dPosX)) {
        // Axe Z pur (orthogonal) — snapZ contraint depuis entity.pos_y
        snapX = moveTarget.entity.pos_x
        snapZ = moveTarget.entity.pos_y + Math.round(dPosZ)
      } else {
        // Diagonal 45° — distance = moyenne arrondie des deux deltas
        const dist = Math.round((Math.abs(dPosX) + Math.abs(dPosZ)) / 2)
        snapX = moveTarget.entity.pos_x + Math.sign(dPosX) * dist
        snapZ = moveTarget.entity.pos_y + Math.sign(dPosZ) * dist
      }

      // dot(AE, AD) — PE27
      // A = acteur (token), E = entité, D = destination (snap)
      const actorToken = tokensRef.current.find(t => t.id === moveTarget.tokenId)
      if (!actorToken) return

      const AE = { x: moveTarget.entity.pos_x - actorToken.pos_x, y: moveTarget.entity.pos_y - actorToken.pos_y }
      const AD = { x: snapX - actorToken.pos_x,                   y: snapZ - actorToken.pos_y }
      const dot = AE.x * AD.x + AE.y * AD.y

      const newGhostPos = { x: snapX, z: snapZ }
      setGhostPos(newGhostPos)
      setDotResult(dot)
      // Ref miroir — lecture stable dans handlePointerUp
      ghostRef.current = { ghostPos: newGhostPos, dotResult: dot }
      return  // ne pas tomber dans la logique drag token
    }

    if (!dragRef.current.active) return
    if (combatPhaseRef.current && !isGm) return  // combat actif — drag silencieux pour PJ (clic toujours détecté)

    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY

    if (!dragRef.current.hasMoved) {
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
      dragRef.current.hasMoved = true
    }

    // 8.C — MJ uniquement : si aucun support de sol sous le curseur, retomber sur le
    // plan Y=0 infini plutôt que d'abandonner le drag (permet de planquer un token
    // hors de toute géométrie construite). Joueur : comportement inchangé (raycast
    // sol strict).
    let destination = raycastWorldSupport(e.clientX, e.clientY)
    if (!destination && isGm) destination = raycastGround(e.clientX, e.clientY)
    if (!destination) return

    let tiltX = 0
    let tiltZ = 0
    if (dragRef.current.prevWorldX !== null) {
      const deltaX = destination.x - dragRef.current.prevWorldX
      const deltaZ = destination.z - dragRef.current.prevWorldZ
      tiltX = Math.max(-DRAG_TILT_MAX, Math.min(DRAG_TILT_MAX, -deltaZ * 2))
      tiltZ = Math.max(-DRAG_TILT_MAX, Math.min(DRAG_TILT_MAX, deltaX * 2))
    }
    dragRef.current.prevWorldX = destination.x
    dragRef.current.prevWorldZ = destination.z
    dragRef.current.destination = destination

    setDragState({
      tokenId: dragRef.current.tokenId,
      x: destination.x,
      y: destination.y + DRAG_HOVER,
      z: destination.z,
      tiltX,
      tiltZ,
    })
  }, [raycastGround, raycastWorldSupport, moveTarget, isGm, requestWorldPathPreview, combatMoveHasPriority, findOccupantAt])

  // ─── Fin du drag ──────────────────────────────────────────────────────────
  const handlePointerUp = useCallback(async (e) => {
    // ─── Mode déplacement combat — seulement si aucun mode explicite n'est prioritaire ─────────
    if (combatMoveHasPriority()) {
      const mode = combatMoveModeRef.current
      // Case cliquée occupée par un autre token — interaction avec ce token, jamais un déplacement
      // (retour Saar 2026-07-31 : un seul geste possible par clic, pas de séquence forcée
      // déplacement-puis-action). hoveredOccupantTokenRef posé par handlePointerMove (même détection
      // par case, source unique).
      if (hoveredOccupantTokenRef.current) {
        onAmbientTokenClickRef.current?.(hoveredOccupantTokenRef.current, e.clientX, e.clientY)
        return
      }
      const path = currentPathRef.current
      if (!path || path.length < 2) return  // inaccessible ou destination = départ
      const dest = path[path.length - 1]
      // Vérification fraîche sur la destination réelle du chemin (pas seulement le dernier survol) —
      // CLICKATTACK-MOVECONFLICT1 : sans `pointermove` ayant recalculé hoveredOccupantTokenRef pile sur
      // cette position juste avant le clic (curseur immobile depuis avant l'armement du survol, léger
      // écart entre point survolé et extrémité du chemin renvoyé par le serveur), un déplacement pouvait
      // partir vers une case en réalité occupée par la cible.
      const destOccupant = findOccupantAt({ x: dest.x, z: dest.z }, mode.tokenId)
      if (destOccupant) {
        onAmbientTokenClickRef.current?.(destOccupant, e.clientX, e.clientY)
        return
      }
      const result = selectCombatMovementForCost(dest.spentM, mode.allures)
      if (!result) return  // hors portée max
      // Le payload de combat conserve les noms DB PE14, mais contient des mètres monde exacts.
      mode.onPendingMove({
        action_key:  result.actionKey,
        ini_mod:     result.initiativeModifier,
        targetPosX:  dest.x,
        targetPosY:  dest.z,
        targetPosZ:  dest.y,
        screenX:     e.clientX,
        screenY:     e.clientY,
      })
      return
    }

    // ─── Mode visée entité — prioritaire sur le drag token ───────────────────
    if (moveTarget) {
      const { ghostPos: gp, dotResult: dr } = ghostRef.current
      if (dr !== 0 && gp) {
        socket.emit(WS.ENTITY_MOVE_REQUEST, {
          entityId: moveTarget.entity.id,
          tokenId: moveTarget.tokenId,
          interactionId: moveTarget.interaction.id,
          moveType: dr > 0 ? 'push' : 'pull',
          destX: gp.x,
          destZ: gp.z,  // = pos_y base (PE14 — malgré le nom destZ)
        })
      }
      onMoveCancel?.()
      setGhostPos(null)
      setDotResult(0)
      ghostRef.current = { ghostPos: null, dotResult: 0 }
      return
    }

    if (onPointerUp(dragRef.current.active)) return
    if (!dragRef.current.active) return

    const wasMoving = dragRef.current.hasMoved
    const token = dragRef.current.token

    if (orbitRef.current) orbitRef.current.enabled = true
    dragRef.current.active = false
    dragRef.current.hasMoved = false
    setDragState(null)

    if (!wasMoving) {
      // Clic court sans déplacement — sélection du token
      // Si le token appartient au joueur ou est GM → émettre TOKEN_ROTATE via callback
      // Propriétaire = character.user_id === user.id OU isGm
      const character = characters.find(c => c.id === token.character_id)
      const isOwner = character?.user_id === user?.id
      if (isOwner || isGm) {
        onTokenDoubleClick?.(token, e.clientX, e.clientY)
      }
      justSelectedRef.current = true
      onTokenSelect(token.id)
      setFreeCameraOverride(false)
      return
    }

    // Position du drop = là où le token ghost était affiché pendant le drag,
    // PAS là où pointe le curseur (qui est souvent caché sous le token).
    const destination = dragRef.current.destination
    if (!destination) return

    try {
      const res = isGm
        ? await api.post(`/tokens/${token.id}/teleport`, { destination })
        : await api.post(`/battlemaps/${battlemapId}/world-move`, {
            token_id: token.id,
            destination,
            gait: 'moyenne',
          })
      const updated = res.data?.token || res.data?.outcome?.token
      if (updated) updateToken(updated)
    } catch (err) {
      console.error('Erreur déplacement token :', err)
    }
  }, [onTokenSelect, updateToken, isGm, justSelectedRef, characters, user, onTokenDoubleClick, socket, moveTarget, onMoveCancel, onPointerUp, battlemapId, combatMoveHasPriority, findOccupantAt])

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp, gl])

  // ─── Drop d'une carte personnage depuis la Sidebar ─────────────────────────
  // Même repli support→sol que le drag de token (8.C ci-dessus, ligne ~894) : un MJ peut viser hors
  // de toute géométrie construite, un joueur reste contraint au support réel.
  useEffect(() => {
    const canvas = gl.domElement
    const handleDragOver = (e) => e.preventDefault()
    const handleDrop = (e) => {
      e.preventDefault()
      const characterId = e.dataTransfer.getData('characterId')
      if (!characterId) return
      let destination = raycastWorldSupport(e.clientX, e.clientY)
      if (!destination && isGm) destination = raycastGround(e.clientX, e.clientY)
      onCharacterDrop?.(characterId, destination)
    }
    canvas.addEventListener('dragover', handleDragOver)
    canvas.addEventListener('drop', handleDrop)
    return () => {
      canvas.removeEventListener('dragover', handleDragOver)
      canvas.removeEventListener('drop', handleDrop)
    }
  }, [gl, raycastWorldSupport, raycastGround, isGm, onCharacterDrop])

  useEffect(() => {
    const canvas = gl.domElement
    const prevent = (e) => e.preventDefault()
    canvas.addEventListener('contextmenu', prevent)
    return () => canvas.removeEventListener('contextmenu', prevent)
  }, [gl])

  // ─── Suppression token (touche Suppr) — GM uniquement ─────────────────────
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (!isGm) return
      if (!selectedTokenId) return
      try {
        await api.delete(`/tokens/${selectedTokenId}`)
        removeToken(selectedTokenId)
      } catch (err) {
        console.error('Erreur suppression token :', err)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isGm, selectedTokenId, removeToken])

  useEffect(() => {
    if (!orbitRef.current) return
    orbitRef.current.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    }
    orbitRef.current.listenToKeyEvents(window)
    orbitRef.current.keyPanSpeed = 20
  }, [])

  // Sprint 2.5 — centrage caméra sur le token actif en mode mouvement combat
  // combatCameraCenter : { x, z } coords DB (PE14) | null
  // Retour à null (annulation) → guard bloque → caméra reste où elle est (PC36)
  useEffect(() => {
    if (!combatCameraCenter || !orbitRef.current) return
    orbitRef.current.target.set(combatCameraCenter.x + 0.5, levelToY(displayLevel), combatCameraCenter.z + 0.5)
    orbitRef.current.update()
  }, [combatCameraCenter, displayLevel])

  // ─── Ligne de visée assaut — segment joueur→cible en attente (Sprint 7.1) ──
  const targetLinePoints = useMemo(() => {
    if (!combatTargetMode?.pendingTargetId || !combatTargetMode?.tokenId) return null
    const myToken = tokensRef.current.find(t => t.id === combatTargetMode.tokenId)
    const tgtToken = tokensRef.current.find(t => t.id === combatTargetMode.pendingTargetId)
    if (!myToken || !tgtToken) return null
    const source = tokenFeetPoint(myToken)
    const target = tokenFeetPoint(tgtToken)
    return new Float32Array([
      source.x, source.y + 1.5, source.z,
      target.x, target.y + 1.5, target.z,
    ])
  }, [combatTargetMode?.pendingTargetId])

  return (
    <>
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#ffffff', '#334155', 0.6]} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.6} />

      {thirdPersonCameraActive ? (
        <ThirdPersonCamera
          token={followToken}
          enabled={thirdPersonCameraActive}
          onTokenSetRotation={onTokenSetRotation}
          updateToken={updateToken}
        />
      ) : (
        <MapControls
          ref={orbitRef}
          mouseButtons={{ LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }}
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2}
        />
      )}

      <Grid
        args={[visibleGridSize, visibleGridSize]}
        position={[0, levelToY(displayLevel), 0]}
        cellColor="#334155"
        sectionColor="#475569"
        fadeDistance={80}
      />

      {hasSurfaceContent(surfaceData) ? (
        <SurfaceDungeonScene
          surfaceData={surfaceData}
          textureMaterials={textureMaterials}
          displayLevel={displayLevel}
          cameraControlsRef={thirdPersonCameraActive ? null : orbitRef}
          onCameraRoomIdChange={setCameraVolumeRoomId}
          runtimeFeatureStates={runtimeFeatureStates}
          selectedConnectorId={selectedSurfaceConnectorId}
          onConnectorSelect={onSurfaceConnectorSelect}
        />
      ) : USE_DIORAMA_TERRAIN ? (
        <DungeonTerrainScene voxels={voxels} textureMaterials={textureMaterials} />
      ) : (
        <CulledVoxelScene voxels={voxels} textureMaterials={textureMaterials} />
      )}

      {(runtimeEffectRegions || []).map(region => {
        const bounds = region?.bounds
        const sliceBottom = levelToY(displayLevel)
        const sliceTop = levelToY(displayLevel + 1)
        if (!bounds) return null
        const centerX = (bounds.min.x + bounds.max.x) / 2
        const centerZ = (bounds.min.z + bounds.max.z) / 2
        const centerY = (bounds.min.y + bounds.max.y) / 2
        const intersectsSlice = bounds.max.y > sliceBottom && bounds.min.y < sliceTop
        const visibleInWorldContext = isWorldPointVisibleAtLevel(
          surfaceData,
          displayLevel,
          centerX,
          centerZ,
          centerY,
          cameraVolumeRoomId,
        )
        if (!intersectsSlice && !visibleInWorldContext) return null
        const size = [bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z]
        const center = [
          centerX,
          (bounds.min.y + bounds.max.y) / 2,
          centerZ,
        ]
        const color = region.definitionKey === 'gas' ? '#a3e635' : region.definitionKey === 'flooded' ? '#38bdf8' : '#fb7185'
        return (
          <mesh key={region.id} position={center} renderOrder={19}>
            <boxGeometry args={size} />
            <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
          </mesh>
        )
      })}

      {/* ── Entités interactables — entre voxels et tokens ────────────────── */}
      {entities.map(entity => {
        const blueprint = blueprints[entity.blueprint_id]
        if (!blueprint) return null
        if (entity.gm_only && !isGm) return null
        if (!isWorldPointVisibleAtLevel(
          surfaceData,
          displayLevel,
          (Number(entity.pos_x) || 0) + 0.5,
          (Number(entity.pos_y) || 0) + 0.5,
          entity.pos_z,
          cameraVolumeRoomId,
        )) return null
        return (
          <EntityMesh
            key={entity.id}
            entity={entity}
            blueprint={blueprint}
            entityTextureMaterials={entityTextureMaterials}
            altPressed={altPressed}
            isGmOnly={entity.gm_only && isGm}
            onEntityClick={onEntityClick}
            sceneOpacity={1}
          />
        )
      })}

      {/* ── Ghost mode visée déplacement (9F-B2) ─────────────────────────── */}
      {/* Plan semi-transparent au sol sur la case destination snappée.          */}
      {/* Couleur = feedback dot(AE,AD) : bleu=push, orange=pull, rouge=impos.   */}
      {/* PE14 : ghostPos.x = pos_x base, ghostPos.z = pos_y base (profondeur)  */}
      {moveTarget && ghostPos && (() => {
        const color = dotResult > 0 ? '#2563eb' : dotResult < 0 ? '#f97316' : '#ef4444'
        const y = (colTopSurface[`${ghostPos.x}:${ghostPos.z}`] ?? 0) + 0.05
        return (
          <group position={[ghostPos.x + 0.5, y, ghostPos.z + 0.5]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color={color} wireframe />
            </mesh>
          </group>
        )
      })()}

      {tokens.filter(token => (
        (isGm || token.layer !== 'gm')
        && isWorldPointVisibleAtLevel(
          surfaceData,
          displayLevel,
          (Number(token.pos_x) || 0) + 0.5,
          (Number(token.pos_y) || 0) + 0.5,
          token.pos_z,
          cameraVolumeRoomId,
        )
      )).map(token => {
        const character = characters.find(c => c.id === token.character_id)
        const glbUrl = character?.glb_url
          ? `${import.meta.env.VITE_API_URL}/api/assets/${character.glb_url}`
          : (defaultTokenGlbUrl || HARDCODED_DEFAULT_TOKEN_URL)
        return (
          <TokenMesh
            key={token.id}
            token={token}
            glbUrl={glbUrl}
            isSelected={selectedTokenId === token.id}
            isActive={activeTokenId === token.id}
            onDragStart={handleDragStart}
            dragState={dragState?.tokenId === token.id ? dragState : null}
            isGmLayer={token.layer === 'gm'}
            sceneOpacity={1}
            statusEffectsMode={statusEffectsMode}
            isAmbientTargetHover={ambientHoverTokenId === token.id}
          />
        )
      })}

      {/* ── Chemin déplacement combat (Sprint Pathfinding) ──────────────── */}
      {/* Cases colorées par allure sur le chemin A* vers le curseur — retour à la version d'origine     */}
      {/* (retour Saar 2026-08-01 : le réticule tuilé sur plusieurs cases donnait un rendu confus,        */}
      {/* cf. capture). Bleu=lente, vert=moyenne, orange=rapide, rouge=max.                               */}
      {/* Les points sont exprimés dans l'espace monde canonique (pieds).                                 */}
      {combatMoveMode && currentPath.map((cell, i) => (
        <group key={`path-${i}`} position={[cell.x, cell.y + 0.05, cell.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.9, 0.9]} />
            <meshBasicMaterial
              color={getCombatPathColor(cell.spentM, combatMoveMode.allures)}
              transparent
              opacity={0.5}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* ── Réticule blanche — case survolée en mode déplacement combat ──── */}
      {combatMoveMode && combatCursorPos && (
        <GroundCursorReticule position={[combatCursorPos.x, combatCursorPos.y + 0.05, combatCursorPos.z]} />
      )}

      {/* ── Case destination sélectionnée — surbrillance bleue (Bug B) ─────── */}
      {combatMoveMode && pendingMoveSelection && (() => {
        return (
          <mesh
            position={[
              pendingMoveSelection.targetPosX,
              pendingMoveSelection.targetPosZ + 0.06,
              pendingMoveSelection.targetPosY,
            ]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.7} depthWrite={false} />
          </mesh>
        )
      })()}

      {/* ── Ligne de visée assaut — joueur→cible pending (Sprint 7.1) ─────── */}
      {targetLinePoints && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={targetLinePoints}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#e07070" linewidth={2} />
        </line>
      )}

      {/* ── Ghosts déplacement — tous les déclarants (CL3) ─── */}
      {phase === 'ANNOUNCEMENT' && announcedActions.filter(e => e.moveTarget).map(entry => {
        const m   = entry.moveTarget
        const src = tokens.find(t => t.id === entry.tokenId)
        // PE14 → Three.js : X=pos_x, Y=pos_z(altitude), Z=pos_y(depth)
        const movePts = src ? new Float32Array([
          src.pos_x + 0.5, src.pos_z + 1.5, src.pos_y + 0.5,
          m.x + 0.5,       m.z + 1.0,       m.y + 0.5,
        ]) : null
        return (
          <group key={entry.tokenId}>
            {/* Marqueur destination */}
            <mesh position={[m.x + 0.5, m.z + 0.5, m.y + 0.5]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial color="#5b8dee" transparent opacity={0.22} />
            </mesh>
            {/* Ligne origine → destination */}
            {movePts && (
              <line>
                <bufferGeometry>
                  <bufferAttribute attach="attributes-position" count={2} array={movePts} itemSize={3} />
                </bufferGeometry>
                <lineBasicMaterial color="#7ab8f5" linewidth={2} />
              </line>
            )}
            {/* Label nom du token au-dessus de la destination */}
            {src && (
              <Billboard position={[m.x + 0.5, m.z + 2.0, m.y + 0.5]}>
                <Text
                  font={FONT_URL}
                  fontSize={0.25}
                  color="#7ab8f5"
                  anchorX="center"
                  anchorY="bottom"
                  outlineWidth={0.03}
                  outlineColor="#000000"
                >
                  {src.label ?? '?'}
                </Text>
              </Billboard>
            )}
          </group>
        )
      })}

      {/* ── Lignes d'annonce assaut — tous les déclarants (CL3) ─── */}
      {phase === 'ANNOUNCEMENT' && announcedActions.filter(e => e.attackTargetId).map(entry => {
        const src = tokensRef.current.find(t => t.id === entry.tokenId)
        const tgt = tokensRef.current.find(t => t.id === entry.attackTargetId)
        if (!src || !tgt) return null
        const pts = new Float32Array([
          src.pos_x + 0.5, src.pos_z + 1.5, src.pos_y + 0.5,
          tgt.pos_x + 0.5, tgt.pos_z + 1.5, tgt.pos_y + 0.5,
        ])
        return (
          <line key={entry.tokenId}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={2} array={pts} itemSize={3} />
            </bufferGeometry>
            <lineBasicMaterial color="#e0a050" linewidth={2} />
          </line>
        )
      })}

      {/* ── Ligne de vue (LOS) — même pattern que targetLinePoints L.1003 ───────── */}
      {losLine && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([...losLine.from, ...losLine.to])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={losLine.clear ? '#70e07a' : '#e07070'} linewidth={2} />
        </line>
      )}
      {/* ── DiceRoller — animation dés (Dice Rework) */}
      {dicePayload && <DiceRoller payload={dicePayload} onDone={onDiceDone} />}
    </>
  )
}

// ─── Composant principal exporté ──────────────────────────────────────────────
// Canvas3D — lecture seule (mode jeu).
// Props : onTokenDoubleClick, socket, onEntityClick, moveTarget, onMoveCancel
// moveTarget     : { entity, interaction, tokenId } | null — mode visée déplacement (9F-B2)
// onMoveCancel   : callback stable (useCallback deps []) — annule le mode visée
// combatMoveMode : { tokenId, allures, onMoveSelected, onCancel, onPendingMove } | null — sélection destination combat (pathfinding)
export default function Canvas3D({ mode = 'play', onTokenDoubleClick, socket, onEntityClick, onTokenSetRotation, moveTarget, onMoveCancel, dicePayload, onDiceDone, combatCameraCenter, combatMoveMode, pendingMoveSelection, combatTargetMode, onAmbientTokenClick, defaultTokenGlbUrl, losMode, onLosCancel, onLosResult, displayLevel = 0, statusEffectsMode = 'enforced', onCharacterDrop }) {
  const { battlemap } = useMapStore()
  const { entities } = useEntityStore()
  const { isGm } = useCharacterStore()

  const [voxels, setVoxels] = useState({})
  const surfaceData = normalizeSurfaceData(battlemap?.surface_data)
  const [textureMaterials, setTextureMaterials] = useState({})
  const [entityTextureMaterials, setEntityTextureMaterials] = useState({})
  const [runtimeEffectRegions, setRuntimeEffectRegions] = useState([])
  const [runtimeElevatorStates, setRuntimeElevatorStates] = useState({})
  const [surfaceConnectorPanel, setSurfaceConnectorPanel] = useState(null)
  const [blocksReady, setBlocksReady] = useState(false)
  const [selectedTokenId, setSelectedTokenId] = useState(null)

  const refreshRuntimeEffects = useCallback(async () => {
    if (!battlemap?.id) return setRuntimeEffectRegions([])
    try {
      const { data } = await api.get(`/battlemaps/${battlemap.id}/world-effects`)
      setRuntimeEffectRegions(data.worldEffects?.regions || [])
    } catch (error) {
      console.error('[Canvas3D] Erreur chargement effets monde :', error)
    }
  }, [battlemap?.id])

  useEffect(() => { refreshRuntimeEffects() }, [refreshRuntimeEffects])

  const refreshRuntimeElevators = useCallback(async () => {
    if (!battlemap?.id) return setRuntimeElevatorStates({})
    try {
      const { data } = await api.get(`/battlemaps/${battlemap.id}/world-elevators`)
      setRuntimeElevatorStates(data.worldElevators?.states || {})
    } catch (error) {
      console.error('[Canvas3D] Erreur chargement ascenseurs monde :', error)
    }
  }, [battlemap?.id])

  useEffect(() => { refreshRuntimeElevators() }, [refreshRuntimeElevators])

  const elevatorsAreTransitioning = useMemo(
    () => Object.values(runtimeElevatorStates).some(state => ['closing', 'moving', 'opening'].includes(state?.phase)),
    [runtimeElevatorStates],
  )

  useEffect(() => {
    if (!elevatorsAreTransitioning) return undefined
    const timer = window.setInterval(refreshRuntimeElevators, 300)
    return () => window.clearInterval(timer)
  }, [elevatorsAreTransitioning, refreshRuntimeElevators])

  useEffect(() => {
    if (!socket || !battlemap?.id) return undefined
    const handleRuntimeUpdate = event => {
      if (String(event?.battlemapId) !== String(battlemap.id)) return
      if (event?.kind !== 'elevator-clock') refreshRuntimeElevators()
      if (!String(event?.kind || '').startsWith('elevator-')) refreshRuntimeEffects()
    }
    socket.on(WS.WORLD_RUNTIME_UPDATED, handleRuntimeUpdate)
    return () => socket.off(WS.WORLD_RUNTIME_UPDATED, handleRuntimeUpdate)
  }, [socket, battlemap?.id, refreshRuntimeEffects, refreshRuntimeElevators])

  // ─── Liseré surbrillance entités (touche Alt) ─────────────────────────────
  // PE16 : e.code obligatoire (invariant AZERTY/QWERTY)
  const [altPressed, setAltPressed] = useState(false)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') setAltPressed(true)
    }
    const onKeyUp = (e) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') setAltPressed(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // ─── Annulation mode visée entité sur Échap ──────────────────────────────
  useEffect(() => {
    if (!moveTarget) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onMoveCancel?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [moveTarget, onMoveCancel])

  // ─── Annulation mode déplacement combat sur Échap ─────────────────────────
  useEffect(() => {
    if (!combatMoveMode) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') combatMoveMode.onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [combatMoveMode])

  // ─── Annulation mode sélection cible sur Échap ────────────────────────────
  useEffect(() => {
    if (!combatTargetMode) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') combatTargetMode.onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [combatTargetMode])

  // ─── Annulation mode LOS sur Échap ─────────────────────────────────────────
  useEffect(() => {
    if (!losMode) return
    const onKeyDown = (e) => { if (e.key === 'Escape') onLosCancel?.() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [losMode, onLosCancel])

  const justSelectedRef = useRef(false)

  const blueprintIds = [...new Set(entities.map(e => e.blueprint_id))].sort().join(',')

  // ─── Initialisation voxels depuis battlemap.voxel_data ────────────────────
  useEffect(() => {
    if (!battlemap?.voxel_data) return
    const map = {}
    for (const [key, val] of Object.entries(battlemap.voxel_data)) {
      const [x, y, z] = key.split(':').map(Number)
      map[key] = { x, y, z, tex: val.tex, geo: val.geo, r: val.r }
    }
    setVoxels(map)
  }, [battlemap?.id, battlemap?.voxel_data])

  // ─── Chargement des voxel_textures nécessaires ───────────────────────────
  useEffect(() => {
    const loadBlocks = async () => {
      setBlocksReady(false)

      const voxelTexIds = battlemap?.voxel_data
        ? [...new Set(Object.values(battlemap.voxel_data).map(v => v.tex))]
        : []
      const surfaceTexIds = surfaceTextureIds(battlemap?.surface_data)
      const textureIds = [...new Set([...voxelTexIds, ...surfaceTexIds])]

      if (textureIds.length === 0) {
        setTextureMaterials({})
      } else {
        try {
          const { data } = await api.get(`/voxel-textures?ids=${textureIds.join(',')}`)
          const loaded = await loadVoxelTextures(data.textures)
          setTextureMaterials(loaded)
        } catch (err) {
          console.error('[Canvas3D] Erreur chargement voxel_textures :', err)
        }
      }

      const fakeTexObjs = []
      for (const entity of entities) {
        const bp = entity.blueprint
        if (!bp?.pack_id) continue
        if (!bp.geometry?.faces) continue

        fakeTexObjs.push({
          id: `${bp.id}__base`,
          pack_id: bp.pack_id,
          faces: bp.geometry.faces,
        })

        for (const state of bp.states || []) {
          const overrides = state.visual_override?.face_overrides || {}
          if (Object.keys(overrides).length === 0) continue
          fakeTexObjs.push({
            id: `${bp.id}__state_${state.id}`,
            pack_id: bp.pack_id,
            faces: { ...bp.geometry.faces, ...overrides },
          })
        }
      }

      if (fakeTexObjs.length > 0) {
        try {
          const flat = await loadVoxelTextures(fakeTexObjs)
          const structured = {}
          for (const entity of entities) {
            const bp = entity.blueprint
            if (!bp?.pack_id) continue
            if (structured[bp.id]) continue
            structured[bp.id] = { base: null, states: {} }
            structured[bp.id].base = flat[`${bp.id}__base`] || null
            for (const state of bp.states || []) {
              const key = `${bp.id}__state_${state.id}`
              if (flat[key]) structured[bp.id].states[state.id] = flat[key]
            }
          }
          setEntityTextureMaterials(structured)
        } catch (err) {
          console.error('[Canvas3D] Erreur chargement entités textures :', err)
        }
      } else {
        setEntityTextureMaterials({})
      }

      // Guard P26 — toujours débloquer le rendu
      setBlocksReady(true)
    }

    loadBlocks()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battlemap?.id, battlemap?.voxel_data, battlemap?.surface_data, blueprintIds])

  const selectedSurfaceConnector = useMemo(() => {
    const id = surfaceConnectorPanel?.connectorId
    const connector = id ? surfaceData.connectors?.[id] : null
    return connector ? { id, ...connector } : null
  }, [surfaceConnectorPanel?.connectorId, surfaceData.connectors])

  const handleSurfaceConnectorSelect = useCallback((connectorId, connector, event) => {
    if (connector?.type !== 'elevator') return
    const source = event?.nativeEvent || event?.sourceEvent || event || {}
    setSurfaceConnectorPanel({
      connectorId,
      x: Number(source.clientX) || 24,
      y: Number(source.clientY) || 24,
    })
  }, [])

  const handleElevatorCommand = useCallback(async (elevatorId, command) => {
    if (!battlemap?.id || !elevatorId) return
    await api.post(`/battlemaps/${battlemap.id}/world-elevators/${elevatorId}/commands`, command)
    await refreshRuntimeElevators()
  }, [battlemap?.id, refreshRuntimeElevators])

  const handleCanvasClick = useCallback(() => {
    if (justSelectedRef.current) { justSelectedRef.current = false; return }
    setSelectedTokenId(null)
    setSurfaceConnectorPanel(null)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <Canvas
      camera={{ position: [15, 15, 15], fov: 60 }}
      style={{ background: '#0f172a' }}
      onClick={handleCanvasClick}
      onCreated={({ gl }) => { gl.shadowMap.enabled = true }}
    >
      <Skydome preset="ocean_floor" />
      {blocksReady && (
        <Scene
          voxels={voxels}
          surfaceData={surfaceData}
          textureMaterials={textureMaterials}
          entityTextureMaterials={entityTextureMaterials}
          runtimeEffectRegions={runtimeEffectRegions}
          runtimeFeatureStates={runtimeElevatorStates}
          socket={socket}
          battlemapId={battlemap?.id}
          selectedTokenId={selectedTokenId}
          selectedSurfaceConnectorId={surfaceConnectorPanel?.connectorId || null}
          onSurfaceConnectorSelect={handleSurfaceConnectorSelect}
          onTokenSelect={setSelectedTokenId}
          onTokenDoubleClick={onTokenDoubleClick}
          justSelectedRef={justSelectedRef}
          altPressed={altPressed}
          onEntityClick={onEntityClick}
          onTokenSetRotation={onTokenSetRotation}
          moveTarget={moveTarget}
          onMoveCancel={onMoveCancel}
          dicePayload={dicePayload}
          onDiceDone={onDiceDone}
          combatCameraCenter={combatCameraCenter}
          combatMoveMode={combatMoveMode}
          pendingMoveSelection={pendingMoveSelection}
          combatTargetMode={combatTargetMode}
          onAmbientTokenClick={onAmbientTokenClick}
          defaultTokenGlbUrl={defaultTokenGlbUrl}
          losMode={losMode}
          onLosCancel={onLosCancel}
          onLosResult={onLosResult}
          statusEffectsMode={statusEffectsMode}
          cameraMode={mode}
          displayLevel={displayLevel}
          onCharacterDrop={onCharacterDrop}
        />
      )}
    </Canvas>
    {surfaceConnectorPanel && selectedSurfaceConnector && (
      <SurfaceConnectorPanel
        connector={selectedSurfaceConnector}
        x={surfaceConnectorPanel.x}
        y={surfaceConnectorPanel.y}
        runtimeState={runtimeElevatorStates[selectedSurfaceConnector.worldId || selectedSurfaceConnector.id] || null}
        onElevatorCommand={handleElevatorCommand}
        canEdit={false}
        canAdminElevator={isGm}
        onClose={() => setSurfaceConnectorPanel(null)}
      />
    )}
    </div>
  )
}
