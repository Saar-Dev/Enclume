import { useRef, useState, useEffect, useCallback, useMemo, Component } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { MapControls, Grid, Text, Billboard, Html } from '@react-three/drei'
import { useGLTF } from '@react-three/drei'
import { useTranslation } from 'react-i18next'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import api from '../lib/api.js'
import { findPath, getPathColor, getActionKey } from '../lib/pathfinder.js'
import raycastVoxels from 'fast-voxel-raycast'
import { WS } from '../../../shared/events.js'
import { loadVoxelTextures } from '../lib/voxelTextures.js'
import CulledVoxelScene from './CulledVoxelScene.jsx'
import EntityMesh from './EntityMesh.jsx'
import DiceRoller from './DiceRoller.jsx'
import { useTokenStore } from '../stores/tokenStore'
import { useCharacterStore } from '../stores/characterStore'
import { useAuthStore } from '../stores/authStore'
import { useMapStore } from '../stores/mapStore'
import { useEntityStore } from '../stores/entityStore'
import { useSessionStore } from '../stores/sessionStore'

// ─── Constantes ───────────────────────────────────────────────────────────────
const GRID_SIZE = 50
const FONT_URL = '/fonts/inter.woff'
const HARDCODED_DEFAULT_TOKEN_URL = '/models/default.glb'

// Seuil en pixels pour distinguer clic court (sélection) de drag
const DRAG_THRESHOLD = 4

// Offset visuel du token au-dessus du sol pendant le drag
const DRAG_HOVER = 0.5

// Amplitude max de l'inclinaison pendant le drag (radians)
const DRAG_TILT_MAX = 0.3

// ─── Utilitaire coordonnées ───────────────────────────────────────────────────
// Convertit une position Three.js en champs base de données.
// Three.js : X = droite, Y = haut, Z = profondeur
// Base      : pos_x = X, pos_y = Z Three.js, pos_z = Y Three.js (altitude)
// NE PAS FAIRE CE MAPPING INLINE — toujours passer par cette fonction.
function threeToDb(tx, ty, tz) {
  return { pos_x: tx, pos_y: tz, pos_z: ty }
}

// Hauteur réelle du sommet d'un voxel en Three.js Y selon sa géométrie.
// Utilisée pour poser les tokens exactement sur la surface (pas dans le vide).
function getVoxelSurfaceTop(v) {
  if (v.geo === 'slab_bottom') return v.y + 0.5  // dalle basse : sommet à mi-case
  return v.y + 1.0                                 // cube, slab_top, autres : sommet en haut de case
}

// ─── Anneau de base du token ──────────────────────────────────────────────────
function TokenRing({ color, isSelected, isDragging, opacity }) {
  const ringRef = useRef()
  const t = useRef(0)

  const baseY = isDragging ? 0.1 : 0.6
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
const Y_OFFSET = 0.5

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
      const { color, isGmLayer, tiltX, tiltZ } = this.props
      return <TokenFallbackBody color={color} isGmLayer={isGmLayer} tiltX={tiltX} tiltZ={tiltZ} />
    }
    return this.props.children
  }
}

// Corps GLB — appelé uniquement quand glbUrl est défini.
// useGLTF suspend le composant le temps du chargement (géré nativement par Canvas R3F).
// useGLTF met en cache par URL — plusieurs tokens partageant la même URL ne téléchargent qu'une fois.
function TokenGlbBody({ glbUrl, isGmLayer, tiltX, tiltZ }) {
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
          if (isGmLayer) {
            m.transparent = true
            m.opacity = 0.5
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
  }, [gltfScene, isGmLayer])

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
function TokenFallbackBody({ color, isGmLayer, tiltX, tiltZ }) {
  return (
    <group position={[0, Y_OFFSET, 0]} rotation={[tiltX, 0, tiltZ]}>
      <mesh position={[0, 0.8, 0]}>
        <capsuleGeometry args={[0.28, 1.0, 4, 8]} />
        <meshLambertMaterial
          color={color}
          transparent={!!isGmLayer}
          opacity={isGmLayer ? 0.5 : 1}
        />
      </mesh>
    </group>
  )
}

const STATUS_CATEGORY_COLOR = {
  entrave:  '#d8a838',
  dot:      '#d84838',
  sens:     '#9858c8',
  chronique:'#38a8c8',
}
const STATUS_CATEGORY = {
  grappled: 'entrave', restrained: 'entrave', off_balance: 'entrave',
  burning: 'dot', acid: 'dot', asphyxia: 'dot', decompression: 'dot', electrocuted: 'dot',
  stunned: 'sens', unconscious: 'sens', blinded: 'sens',
  hypothermia: 'chronique', infected: 'chronique', poisoned: 'chronique', irradiated: 'chronique',
}

// Token individuel — gère drag, lerp, ring, label.
// glbUrl : URL complète du GLB à charger (character.glb_url ou default_token_glb_url de campagne), ou null.
// Si null → TokenFallbackBody (silhouette géométrique). Si défini → TokenGlbBody (modèle 3D).
function TokenMesh({ token, glbUrl, isSelected, onDragStart, dragState, isGmLayer }) {
  const color = token.user_color || token.color || '#4A90D9'
  const label = token.label || '?'

  const baseX = token.pos_x ?? 0
  const baseY = token.pos_z ?? 0
  const baseZ = token.pos_y ?? 0

  const isDragging = dragState !== null
  const x = isDragging ? dragState.x + 0.5 : baseX + 0.5
  const y = isDragging ? dragState.y : baseY + 0.5
  const z = isDragging ? dragState.z + 0.5 : baseZ + 0.5

  const tiltX = isDragging ? dragState.tiltX : 0
  const tiltZ = isDragging ? dragState.tiltZ : 0

  // PE21 : rotation.y = r * Math.PI / 4 — 8 orientations, incréments 45°
  // Appliqué sur le <group> parent — indépendant du tilt de drag (sur le corps)
  const rotationY = (token.r ?? 0) * Math.PI / 4

  // ── Lerp 300ms — P40 : position via ref, jamais via state dans useFrame ──
  const groupRef = useRef()
  const lerpPos = useRef({ x: baseX + 0.5, y: baseY + 0.5, z: baseZ + 0.5 })
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
        e.stopPropagation()
        onDragStart(e, token)
      }}
    >
      <TokenRing color={color} isSelected={isSelected} isDragging={isDragging} opacity={isGmLayer ? 0.25 : undefined} />
      <TokenGlbErrorBoundary color={color} isGmLayer={isGmLayer} tiltX={tiltX} tiltZ={tiltZ}>
        <TokenGlbBody glbUrl={glbUrl} isGmLayer={isGmLayer} tiltX={tiltX} tiltZ={tiltZ} />
      </TokenGlbErrorBoundary>
      <Billboard>
        <Text
          position={[0, 2.5, 0]}
          font={FONT_URL}
          fontSize={0.3}
          color={color}
          fillOpacity={isGmLayer ? 0.5 : 1}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          {label}
        </Text>
        {isGmLayer && (
          <Text
            position={[0, 2.85, 0]}
            font={FONT_URL}
            fontSize={0.22}
            color="#a855f7"
            anchorX="center"
            anchorY="bottom"
          >
            {'\u2298 GM'}
          </Text>
        )}
        {(token.statuses?.length > 0) && (
          <Html position={[0, 2.1, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {(token.statuses.length > 4
                ? token.statuses.slice(0, 3)
                : token.statuses
              ).map(code => {
                const color = STATUS_CATEGORY_COLOR[STATUS_CATEGORY[code]] ?? '#888'
                return (
                  <img
                    key={code}
                    src={`/assets/status/${code}.svg`}
                    width={14}
                    height={14}
                    alt={code}
                    style={{
                      borderRadius: 2,
                      background: `${color}44`,
                      outline: `1px solid ${color}99`,
                      filter: `drop-shadow(0 0 2px ${color})`,
                    }}
                  />
                )
              })}
              {token.statuses.length > 4 && (
                <span style={{
                  fontSize: 9,
                  color: '#ccc',
                  background: 'rgba(0,0,0,0.6)',
                  borderRadius: 2,
                  padding: '0 2px',
                  lineHeight: '14px',
                  outline: '1px solid rgba(255,255,255,0.2)',
                }}>
                  +{token.statuses.length - 3}
                </span>
              )}
            </div>
          </Html>
        )}
      </Billboard>
    </group>
  )
}

// ─── Scène principale ─────────────────────────────────────────────────────────
// Lecture seule voxels + tokens + entités + WS listeners.
// La logique d'édition (pose, suppression, rotation) est dans Editor3D.
function Scene({
  voxels, setVoxels, textureMaterials, entityTextureMaterials, socket, battlemapId,
  selectedTokenId, onTokenSelect,
  onTokenDoubleClick, justSelectedRef,
  altPressed, onEntityClick, onTokenRotate,
  moveTarget, onMoveCancel, moveLabels,
  dicePayload, onDiceDone,
  combatCameraCenter,
  combatMoveMode,
  combatTargetMode,
  defaultTokenGlbUrl,
}) {
  const { camera, gl } = useThree()
  const orbitRef = useRef()
  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  // Lecture des stores — pas de props pour ces données
  const { tokens, updateToken, removeToken } = useTokenStore()
  const { characters, isGm } = useCharacterStore()
  const { user } = useAuthStore()
  const { entities, blueprints, addEntity, removeEntity, updateEntity } = useEntityStore()

  const [dragState, setDragState] = useState(null)

  // ─── Mode visée déplacement — states + refs ───────────────────────────────
  // ghostPos/dotResult : states pour le rendu JSX du ghost
  // ghostRef : ref miroir pour lecture stable dans handlePointerUp (pattern P40)
  // tokensRef : ref miroir de tokens pour handlePointerMove stable (pattern P40)
  const [ghostPos, setGhostPos] = useState(null)   // null | { x, z } — coords base (PE14)
  const [dotResult, setDotResult] = useState(0)    // >0 push, <0 pull, =0 impossible
  const ghostRef = useRef({ ghostPos: null, dotResult: 0 })
  const tokensRef = useRef(tokens)
  tokensRef.current = tokens

  // ─── Mode déplacement combat — P40 : ref miroir pour handlers stables ─────
  const combatMoveModeRef = useRef(null)
  combatMoveModeRef.current = combatMoveMode

  // ─── Mode sélection cible combat — P40 : ref miroir ───────────────────────
  const combatTargetModeRef = useRef(null)
  combatTargetModeRef.current = combatTargetMode

  // ─── Chemin pathfinding combat (Sprint Pathfinding) ──────────────────────
  const [currentPath, setCurrentPath] = useState([])
  const currentPathRef = useRef([])
  currentPathRef.current = currentPath

  const voxelsRef = useRef(voxels)
  voxelsRef.current = voxels

  const lastCellRef = useRef(null)

  // Position curseur snappé (Three.js floor coords) — visible uniquement en mode combat
  const [combatCursorPos, setCombatCursorPos] = useState(null)

  // Nettoyage chemin + curseur quand on quitte le mode déplacement
  useEffect(() => {
    if (!combatMoveMode) {
      setCombatCursorPos(null)
      setCurrentPath([])
      lastCellRef.current = null
    }
  }, [combatMoveMode])

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

  const getVoxelKey = (x, y, z) => `${x}:${y}:${z}`

  // ─── Écoute voxels temps réel ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    const handleVoxelAdded = ({ x, y, z, tex, geo, r }) => {
      const key = getVoxelKey(x, y, z)
      setVoxels(prev => ({ ...prev, [key]: { x, y, z, tex, geo, r } }))
    }

    const handleVoxelRemoved = ({ x, y, z }) => {
      const key = getVoxelKey(x, y, z)
      setVoxels(prev => { const next = { ...prev }; delete next[key]; return next })
    }

    const handleVoxelUpdated = ({ battlemapId: incomingId, x, y, z, r }) => {
      if (incomingId !== battlemapId) return
      const key = getVoxelKey(x, y, z)
      setVoxels(prev => {
        if (!prev[key]) return prev
        return { ...prev, [key]: { ...prev[key], r } }
      })
    }

    socket.on(WS.VOXEL_ADDED, handleVoxelAdded)
    socket.on(WS.VOXEL_REMOVED, handleVoxelRemoved)
    socket.on(WS.VOXEL_UPDATED, handleVoxelUpdated)

    // ─── Écoute entités temps réel ───────────────────────────────────────
    const handleEntityCreated = ({ entity }) => addEntity(entity)
    const handleEntityDeleted = ({ entityId }) => removeEntity(entityId)
    const handleEntityUpdated = ({ entityId, current_state_id, state, updated_at }) => {
      updateEntity({ id: entityId, current_state_id, state, updated_at })
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
      socket.off(WS.VOXEL_ADDED, handleVoxelAdded)
      socket.off(WS.VOXEL_REMOVED, handleVoxelRemoved)
      socket.off(WS.VOXEL_UPDATED, handleVoxelUpdated)
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

  // Raycast précis à travers la grille voxel — pour le mode déplacement combat.
  // Retourne { x, z, isVoid } avec x/z en coordonnées entières Three.js (colonne).
  // isVoid=true : aucun voxel touché (zone vide) — GM autorisé, joueur bloqué.
  // Technique : Amanatides/Woo + décalage 0.5 dans la normale → case adjacente ouverte.
  const raycastVoxelColumn = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)

    const origin = raycaster.ray.origin
    const dir    = raycaster.ray.direction
    const hitPos  = [0, 0, 0]
    const hitNorm = [0, 0, 0]

    const getVoxel = (x, y, z) => !!voxelsRef.current[`${x}:${y}:${z}`]

    const hit = raycastVoxels(
      getVoxel,
      [origin.x, origin.y, origin.z],
      [dir.x,    dir.y,    dir.z],
      100,
      hitPos,
      hitNorm
    )

    if (hit) {
      const adjX = hitPos[0] + hitNorm[0] * 0.5
      const adjZ = hitPos[2] + hitNorm[2] * 0.5
      return {
        x: Math.floor(adjX),
        z: Math.floor(adjZ),
        rawX: adjX,
        rawZ: adjZ,
        isVoid: false,
      }
    }

    // Aucun voxel touché — fallback plan y=0
    const target = new THREE.Vector3()
    const groundPlane0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const fallback = raycaster.ray.intersectPlane(groundPlane0, target)
    if (!fallback) return null
    return { x: Math.floor(target.x), z: Math.floor(target.z), rawX: target.x, rawZ: target.z, isVoid: true }
  }, [camera, gl])

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

  const handleDragStart = useCallback((e, token) => {
    e.stopPropagation()
    if (e.nativeEvent.button !== 0) return
    if (combatMoveModeRef.current) return  // mode déplacement combat — pas de drag token
    if (combatTargetModeRef.current) {
      combatTargetModeRef.current.onPendingTarget(token.id)
      return
    }

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
      snappedX: null,
      snappedZ: null,
      surfaceY: null,
    }
    if (orbitRef.current) orbitRef.current.enabled = false
  }, [isGm, user, characters])

  const handlePointerMove = useCallback((e) => {
    // ─── Mode déplacement combat — prioritaire sur tout ───────────────────────
    if (combatMoveModeRef.current) {
      const cell = raycastVoxelColumn(e.clientX, e.clientY)
      if (!cell) return
      if (cell.isVoid && !isGm) return  // joueur : interdit de marcher dans le vide
      // Throttle : ne recalculer que si la case change
      if (cell.x !== lastCellRef.current?.x || cell.z !== lastCellRef.current?.z) {
        lastCellRef.current = cell
        setCombatCursorPos(cell)
        const mode = combatMoveModeRef.current
        const actorToken = tokensRef.current.find(t => t.id === mode.tokenId)
        if (actorToken) {
          const from = { x: actorToken.pos_x, z: actorToken.pos_y, posZ: actorToken.pos_z }
          const path = findPath(voxelsRef.current, tokensRef.current, [], from, cell, mode.allures, { excludeTokenId: mode.tokenId })
          currentPathRef.current = path ?? []
          setCurrentPath(path ?? [])
        }
      }
      return
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

    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY

    if (!dragRef.current.hasMoved) {
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
      dragRef.current.hasMoved = true
    }

    const cell = raycastVoxelColumn(e.clientX, e.clientY)
    if (!cell) return

    const snappedX = Math.floor(cell.rawX)
    const snappedZ = Math.floor(cell.rawZ)
    const surfaceY = colTopSurface[`${snappedX}:${snappedZ}`] ?? 0

    let tiltX = 0
    let tiltZ = 0
    if (dragRef.current.prevWorldX !== null) {
      const deltaX = cell.rawX - dragRef.current.prevWorldX
      const deltaZ = cell.rawZ - dragRef.current.prevWorldZ
      tiltX = Math.max(-DRAG_TILT_MAX, Math.min(DRAG_TILT_MAX, -deltaZ * 2))
      tiltZ = Math.max(-DRAG_TILT_MAX, Math.min(DRAG_TILT_MAX, deltaX * 2))
    }
    dragRef.current.prevWorldX = cell.rawX
    dragRef.current.prevWorldZ = cell.rawZ
    dragRef.current.snappedX = snappedX
    dragRef.current.snappedZ = snappedZ
    dragRef.current.surfaceY = surfaceY

    setDragState({
      tokenId: dragRef.current.tokenId,
      x: snappedX,
      y: Math.max(0, surfaceY - 0.5) + DRAG_HOVER,
      z: snappedZ,
      tiltX,
      tiltZ,
    })
  }, [raycastGround, raycastVoxelColumn, colTopSurface, moveTarget, isGm])

  // ─── Fin du drag ──────────────────────────────────────────────────────────
  const handlePointerUp = useCallback(async (e) => {
    // ─── Mode déplacement combat — prioritaire sur tout ───────────────────────
    if (combatMoveModeRef.current) {
      const mode = combatMoveModeRef.current
      const path = currentPathRef.current
      if (!path || path.length < 2) return  // inaccessible ou destination = départ
      const dest = path[path.length - 1]
      const result = getActionKey(path.length - 1, mode.allures)
      if (!result) return  // hors portée max
      // PE14 : targetPosY = Z Three.js (profondeur)
      // Bug 2 fix : targetPosZ = Math.round(feetGridY/2) - 1 (pieds → altitude DB)
      mode.onPendingMove({
        action_key:  result.action_key,
        ini_mod:     result.ini_mod,
        targetPosX:  dest.x,
        targetPosY:  dest.z,
        targetPosZ:  Math.round(dest.feetGridY / 2) - 1,
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
      return
    }

    // Position du drop = là où le token ghost était affiché pendant le drag,
    // PAS là où pointe le curseur (qui est souvent caché sous le token).
    const snappedX = dragRef.current.snappedX
    const snappedZ = dragRef.current.snappedZ
    const surfaceY = dragRef.current.surfaceY
    if (snappedX === null || snappedZ === null || surfaceY === null) return

    if (!isGm && surfaceY === 0) return  // joueur : interdit de poser dans le vide
    if (Math.abs(snappedX) > GRID_SIZE / 2 || Math.abs(snappedZ) > GRID_SIZE / 2) return

    const dbPos = threeToDb(snappedX, surfaceY - 1.0, snappedZ)

    try {
      const res = await api.put(`/tokens/${token.id}`, dbPos)
      updateToken(res.data.token)
    } catch (err) {
      console.error('Erreur déplacement token :', err)
    }
  }, [onTokenSelect, updateToken, isGm, justSelectedRef, characters, user, onTokenDoubleClick, socket, moveTarget, onMoveCancel])

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp, gl])

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
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    }
    orbitRef.current.listenToKeyEvents(window)
    orbitRef.current.keyPanSpeed = 20
  }, [])

  // Sprint 2.5 — centrage caméra sur le token actif en mode mouvement combat
  // combatCameraCenter : { x, z } coords DB (PE14) | null
  // Retour à null (annulation) → guard bloque → caméra reste où elle est (PC36)
  useEffect(() => {
    if (!combatCameraCenter || !orbitRef.current) return
    orbitRef.current.target.set(combatCameraCenter.x + 0.5, 0, combatCameraCenter.z + 0.5)
    orbitRef.current.update()
  }, [combatCameraCenter])

  // ─── Ligne de visée assaut — segment joueur→cible en attente (Sprint 7.1) ──
  const targetLinePoints = useMemo(() => {
    if (!combatTargetMode?.pendingTargetId || !combatTargetMode?.tokenId) return null
    const myToken = tokensRef.current.find(t => t.id === combatTargetMode.tokenId)
    const tgtToken = tokensRef.current.find(t => t.id === combatTargetMode.pendingTargetId)
    if (!myToken || !tgtToken) return null
    // PE14 + PE34 : Three.js coords — pieds + 0.5 hauteur token
    return new Float32Array([
      myToken.pos_x + 0.5,  myToken.pos_z + 1.5,  myToken.pos_y + 0.5,
      tgtToken.pos_x + 0.5, tgtToken.pos_z + 1.5, tgtToken.pos_y + 0.5,
    ])
  }, [combatTargetMode?.pendingTargetId])

  return (
    <>
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#ffffff', '#334155', 0.6]} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.6} />

      <MapControls
        ref={orbitRef}
        mouseButtons={{ LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2}
      />

      <Grid
        args={[GRID_SIZE, GRID_SIZE]}
        position={[0, 0, 0]}
        cellColor="#334155"
        sectionColor="#475569"
        fadeDistance={80}
      />

      <CulledVoxelScene voxels={voxels} textureMaterials={textureMaterials} />

      {/* ── Entités interactables — entre voxels et tokens ────────────────── */}
      {entities.map(entity => {
        const blueprint = blueprints[entity.blueprint_id]
        if (!blueprint) return null
        return (
          <EntityMesh
            key={entity.id}
            entity={entity}
            blueprint={blueprint}
            entityTextureMaterials={entityTextureMaterials}
            altPressed={altPressed}
            isGmOnly={entity.gm_only && isGm}
            onEntityClick={onEntityClick}
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

      {tokens.filter(token => isGm || token.layer !== 'gm').map(token => {
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
            onDragStart={handleDragStart}
            dragState={dragState?.tokenId === token.id ? dragState : null}
            isGmLayer={token.layer === 'gm'}
          />
        )
      })}

      {/* ── Chemin déplacement combat (Sprint Pathfinding) ──────────────── */}
      {/* Cases colorées par allure sur le chemin A* vers le curseur.         */}
      {/* Bleu = lente, vert = moyenne, orange = rapide, rouge = max          */}
      {/* feetGridY / 2 = hauteur Three.js des pieds sur cette case           */}
      {combatMoveMode && currentPath.map((cell, i) => (
        <mesh
          key={`path-${i}`}
          position={[cell.x + 0.5, cell.feetGridY / 2 + 0.05, cell.z + 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.9, 0.9]} />
          <meshBasicMaterial
            color={getPathColor(cell.distFromStart, combatMoveMode.allures)}
            transparent
            opacity={0.5}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* ── Cursor wireframe case survolée en mode déplacement combat ────── */}
      {combatMoveMode && combatCursorPos && (() => {
        const curToken = tokensRef.current.find(t => t.id === combatMoveMode.tokenId)
        const cursorY = curToken ? curToken.pos_z + 1.0 + 0.05 : 0.1
        return (
          <mesh
            position={[combatCursorPos.x + 0.5, cursorY, combatCursorPos.z + 0.5]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#ffffff" wireframe />
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

      {/* ── DiceRoller — animation dés (Dice Rework) */}
      {dicePayload && <DiceRoller payload={dicePayload} onDone={onDiceDone} />}
    </>
  )
}

// ─── Composant principal exporté ──────────────────────────────────────────────
// Canvas3D — lecture seule (mode jeu).
// Props : onTokenDoubleClick, socket, onEntityClick, onTokenRotate, moveTarget, onMoveCancel
// onTokenRotate  : callback → SessionPage émet WS.TOKEN_ROTATE
// moveTarget     : { entity, interaction, tokenId } | null — mode visée déplacement (9F-B2)
// onMoveCancel   : callback stable (useCallback deps []) — annule le mode visée
// combatMoveMode : { tokenId, allures, onMoveSelected, onCancel, onPendingMove } | null — sélection destination combat (pathfinding)
export default function Canvas3D({ onTokenDoubleClick, socket, onEntityClick, onTokenRotate, moveTarget, onMoveCancel, dicePayload, onDiceDone, combatCameraCenter, combatMoveMode, combatTargetMode, defaultTokenGlbUrl }) {
  const { t } = useTranslation()
  const { battlemap } = useMapStore()
  const { entities } = useEntityStore()

  // Labels i18n pour le ghost — calculés ici où t() est accessible, passés en prop à Scene
  const moveLabels = {
    push:       t('entity.movePush'),
    pull:       t('entity.movePull'),
    impossible: t('entity.moveImpossible'),
  }

  const [voxels, setVoxels] = useState({})
  const [textureMaterials, setTextureMaterials] = useState({})
  const [entityTextureMaterials, setEntityTextureMaterials] = useState({})
  const [blocksReady, setBlocksReady] = useState(false)
  const [selectedTokenId, setSelectedTokenId] = useState(null)

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

      if (voxelTexIds.length === 0) {
        setTextureMaterials({})
      } else {
        try {
          const { data } = await api.get(`/voxel-textures?ids=${voxelTexIds.join(',')}`)
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
  }, [battlemap?.id, battlemap?.voxel_data, blueprintIds])

  const handleCanvasClick = useCallback(() => {
    if (justSelectedRef.current) { justSelectedRef.current = false; return }
    setSelectedTokenId(null)
  }, [])

  return (
    <Canvas
      camera={{ position: [15, 15, 15], fov: 60 }}
      style={{ background: '#0f172a' }}
      onClick={handleCanvasClick}
      onCreated={({ gl }) => { gl.shadowMap.enabled = true }}
    >
      {blocksReady && (
        <Scene
          voxels={voxels}
          setVoxels={setVoxels}
          textureMaterials={textureMaterials}
          entityTextureMaterials={entityTextureMaterials}
          socket={socket}
          battlemapId={battlemap?.id}
          selectedTokenId={selectedTokenId}
          onTokenSelect={setSelectedTokenId}
          onTokenDoubleClick={onTokenDoubleClick}
          justSelectedRef={justSelectedRef}
          altPressed={altPressed}
          onEntityClick={onEntityClick}
          onTokenRotate={onTokenRotate}
          moveTarget={moveTarget}
          onMoveCancel={onMoveCancel}
          moveLabels={moveLabels}
          dicePayload={dicePayload}
          onDiceDone={onDiceDone}
          combatCameraCenter={combatCameraCenter}
          combatMoveMode={combatMoveMode}
          combatTargetMode={combatTargetMode}
          defaultTokenGlbUrl={defaultTokenGlbUrl}
        />
      )}
    </Canvas>
  )
}
