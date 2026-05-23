import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { MapControls, Grid, Text } from '@react-three/drei'
import { useGLTF } from '@react-three/drei'
import { useTranslation } from 'react-i18next'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import { loadVoxelTextures } from '../lib/voxelTextures.js'
import Voxel from './Voxel.jsx'
import EntityMesh from './EntityMesh.jsx'
import DiceRoller from './DiceRoller.jsx'
import { useTokenStore } from '../stores/tokenStore'
import { useCharacterStore } from '../stores/characterStore'
import { useAuthStore } from '../stores/authStore'
import { useMapStore } from '../stores/mapStore'
import { useEntityStore } from '../stores/entityStore'

// ─── Constantes ───────────────────────────────────────────────────────────────
const GRID_SIZE = 50
const DEFAULT_TOKEN_URL = `${import.meta.env.VITE_API_URL}/api/assets/tokens/default.glb`
const FONT_URL = '/fonts/inter.woff'

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

// glbUrl : URL complète du GLB à charger — calculée dans Scene depuis character.glb_url
// ou DEFAULT_TOKEN_URL si pas de modèle custom.
// useGLTF met en cache par URL — si plusieurs tokens partagent la même URL,
// le fichier n'est téléchargé qu'une seule fois.
function TokenMesh({ token, glbUrl, isSelected, onDragStart, onTokenDoubleClick, dragState, isGmLayer }) {
  const color = token.color || '#4A90D9'
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
  // Appliqué sur le <group> parent — indépendant du tilt de drag (sur le <primitive>)
  const rotationY = (token.r ?? 0) * Math.PI / 4

  // ── Lerp 300ms — P40 : position via ref, jamais via state dans useFrame ──
  const groupRef = useRef()
  const lerpPos = useRef({ x: baseX + 0.5, y: baseY + 0.5, z: baseZ + 0.5 })
  // targetRef et isDraggingRef évitent les closures stales dans useFrame
  const targetRef = useRef({ x, y, z })
  targetRef.current = { x, y, z }
  const isDraggingRef = useRef(isDragging)
  isDraggingRef.current = isDragging

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (isDraggingRef.current) {
      // Drag : snap immédiat — pas de Lerp
      groupRef.current.position.set(targetRef.current.x, targetRef.current.y, targetRef.current.z)
      lerpPos.current.x = targetRef.current.x
      lerpPos.current.y = targetRef.current.y
      lerpPos.current.z = targetRef.current.z
    } else {
      // Lerp exponentiel — tau=0.1 → 95% en ~300ms
      const alpha = 1 - Math.exp(-delta / 0.1)
      lerpPos.current.x += (targetRef.current.x - lerpPos.current.x) * alpha
      lerpPos.current.y += (targetRef.current.y - lerpPos.current.y) * alpha
      lerpPos.current.z += (targetRef.current.z - lerpPos.current.z) * alpha
      groupRef.current.position.set(lerpPos.current.x, lerpPos.current.y, lerpPos.current.z)
    }
  })

  // useGLTF suspend le composant le temps du chargement (géré nativement par Canvas R3F).
  const { scene: gltfScene } = useGLTF(glbUrl)

  const clonedScene = useMemo(() => {
    if (!gltfScene) return null
    const clone = SkeletonUtils.clone(gltfScene)
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        // Cloner les materiaux AVANT toute mutation - partages par reference
        // entre tous les clones du meme gltfScene. Sans clone, muter opacity
        // sur un token GM corrompt les materiaux de tous les autres tokens.
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
    // rotation.y permanent sur le group — PE21
    // Le tilt de drag reste sur le <primitive> — indépendant
    // position pilotée par useFrame (Lerp) — jamais via prop JSX
    <group
      ref={groupRef}
      rotation={[0, rotationY, 0]}
      userData={{ isToken: true, tokenId: token.id }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onDragStart(e, token)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onTokenDoubleClick?.(token, e.clientX, e.clientY)
      }}
    >
      <TokenRing color={color} isSelected={isSelected} isDragging={isDragging} opacity={isGmLayer ? 0.25 : undefined} />
      <primitive
        object={clonedScene}
        position={[0, Y_OFFSET, 0]}
        scale={[1, 1, 1]}
        rotation={[tiltX, 0, tiltZ]}
      />
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

  // Position curseur snappé (Three.js floor coords) — visible uniquement en mode combat
  const [combatCursorPos, setCombatCursorPos] = useState(null)

  // Nettoyage curseur quand on quitte le mode (cancel ou sélection)
  useEffect(() => {
    if (!combatMoveMode) setCombatCursorPos(null)
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

  const getColumnTopY = useCallback((x, z) => {
    let maxY = -1
    for (const v of Object.values(voxels)) {
      if (v.x === x && v.z === z) maxY = Math.max(maxY, v.y)
    }
    return maxY
  }, [voxels])

  const handleDragStart = useCallback((e, token) => {
    e.stopPropagation()
    if (e.nativeEvent.button !== 0) return
    if (combatMoveModeRef.current) return  // mode déplacement combat — pas de drag token

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
    }
    if (orbitRef.current) orbitRef.current.enabled = false
  }, [isGm, user, characters])

  const handlePointerMove = useCallback((e) => {
    // ─── Mode déplacement combat — prioritaire sur tout ───────────────────────
    if (combatMoveModeRef.current) {
      const worldPos = raycastGround(e.clientX, e.clientY)
      if (!worldPos) return
      setCombatCursorPos({ x: Math.floor(worldPos.x), z: Math.floor(worldPos.z) })
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

    const worldPos = raycastGround(e.clientX, e.clientY)
    if (!worldPos) return

    const snappedX = Math.round(worldPos.x)
    const snappedZ = Math.round(worldPos.z)
    const columnY = getColumnTopY(snappedX, snappedZ)

    let tiltX = 0
    let tiltZ = 0
    if (dragRef.current.prevWorldX !== null) {
      const deltaX = worldPos.x - dragRef.current.prevWorldX
      const deltaZ = worldPos.z - dragRef.current.prevWorldZ
      tiltX = Math.max(-DRAG_TILT_MAX, Math.min(DRAG_TILT_MAX, -deltaZ * 2))
      tiltZ = Math.max(-DRAG_TILT_MAX, Math.min(DRAG_TILT_MAX, deltaX * 2))
    }
    dragRef.current.prevWorldX = worldPos.x
    dragRef.current.prevWorldZ = worldPos.z

    setDragState({
      tokenId: dragRef.current.tokenId,
      x: worldPos.x,
      y: Math.max(0, columnY) + 0.5 + DRAG_HOVER,
      z: worldPos.z,
      tiltX,
      tiltZ,
    })
  }, [raycastGround, getColumnTopY, moveTarget])

  // ─── Fin du drag ──────────────────────────────────────────────────────────
  const handlePointerUp = useCallback(async (e) => {
    // ─── Mode déplacement combat — prioritaire sur tout ───────────────────────
    if (combatMoveModeRef.current) {
      const mode = combatMoveModeRef.current
      const worldPos = raycastGround(e.clientX, e.clientY)
      if (!worldPos) return
      // Coords voxel cliqué (Three.js floor = indice de colonne)
      const vx = Math.floor(worldPos.x)
      const vz = Math.floor(worldPos.z)
      // Token joueur pour calculer la distance
      const playerToken = tokensRef.current.find(t => t.id === mode.tokenId)
      if (playerToken) {
        // Distance centre→centre (PE14 : pos_y = Z Three.js)
        const dx = vx - playerToken.pos_x
        const dz = vz - playerToken.pos_y
        const dist = Math.sqrt(dx * dx + dz * dz)
        const { allures } = mode
        let action_key, ini_mod
        if (dist <= allures.lente)          { action_key = 'move_short'; ini_mod = -3 }
        else if (dist <= allures.moyenne)   { action_key = 'move_long';  ini_mod = -5 }
        else if (dist <= allures.rapide)    { action_key = 'move_long';  ini_mod = -7 }
        else if (dist <= allures.max)       { action_key = 'move_long';  ini_mod =  0 }
        else return  // hors portée max — ignorer

        // Conversion PE14 : vx = pos_x, vz = pos_y (profondeur = Z Three.js), altitude = 0
        mode.onPendingMove({ action_key, ini_mod, targetPosX: vx, targetPosY: vz, targetPosZ: 0 })
      }
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
        onTokenRotate?.(token.id)
      }
      justSelectedRef.current = true
      onTokenSelect(token.id)
      return
    }

    const worldPos = raycastGround(e.clientX, e.clientY)
    if (!worldPos) return

    const snappedX = Math.round(worldPos.x)
    const snappedZ = Math.round(worldPos.z)
    const snappedY = getColumnTopY(snappedX, snappedZ)

    const minY = isGm ? -1 : 0
    const maxY = isGm ? 8 : 7
    if (snappedY < minY || snappedY > maxY) return
    if (Math.abs(snappedX) > GRID_SIZE / 2 || Math.abs(snappedZ) > GRID_SIZE / 2) return

    const dbPos = threeToDb(snappedX, snappedY, snappedZ)

    try {
      const res = await api.put(`/tokens/${token.id}`, dbPos)
      updateToken(res.data.token)
    } catch (err) {
      console.error('Erreur déplacement token :', err)
    }
  }, [raycastGround, getColumnTopY, onTokenSelect, updateToken, isGm, justSelectedRef, characters, user, onTokenRotate, socket, moveTarget, onMoveCancel])

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

      {Object.values(voxels).map(v => (
        <Voxel
          key={getVoxelKey(v.x, v.y, v.z)}
          position={[v.x, v.y, v.z]}
          textureMaterials={textureMaterials[v.tex]}
          geometry={v.geo}
          rotation={v.r}
        />
      ))}

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
        const y = getColumnTopY(ghostPos.x, ghostPos.z) + 1 + 0.05
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
          : DEFAULT_TOKEN_URL
        return (
          <TokenMesh
            key={token.id}
            token={token}
            glbUrl={glbUrl}
            isSelected={selectedTokenId === token.id}
            onDragStart={handleDragStart}
            onTokenDoubleClick={onTokenDoubleClick}
            dragState={dragState?.tokenId === token.id ? dragState : null}
            isGmLayer={token.layer === 'gm'}
          />
        )
      })}

      {/* ── Anneaux déplacement combat (Sprint 4) ────────────────────────── */}
      {/* 4 zones concentriques centrées sur le token joueur actif.             */}
      {/* Lente=bleu, Moyenne=vert, Rapide=orange, Max=rouge — opacité 0.25    */}
      {/* PE14 : pos_y du token = Z Three.js (profondeur)                      */}
      {combatMoveMode && (() => {
        const { allures, tokenId } = combatMoveMode
        const myToken = tokensRef.current.find(t => t.id === tokenId)
        if (!myToken) return null
        const cx = myToken.pos_x + 0.5
        const cz = myToken.pos_y + 0.5  // PE14
        return (
          <group position={[cx, myToken.pos_z + 1.0 + 0.05, cz]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh>
              <circleGeometry args={[allures.lente, 64]} />
              <meshBasicMaterial color="#3b82f6" transparent opacity={0.25} depthWrite={false} />
            </mesh>
            <mesh>
              <ringGeometry args={[allures.lente, allures.moyenne, 64]} />
              <meshBasicMaterial color="#22c55e" transparent opacity={0.25} depthWrite={false} />
            </mesh>
            <mesh>
              <ringGeometry args={[allures.moyenne, allures.rapide, 64]} />
              <meshBasicMaterial color="#f97316" transparent opacity={0.25} depthWrite={false} />
            </mesh>
            <mesh>
              <ringGeometry args={[allures.rapide, allures.max, 64]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.25} depthWrite={false} />
            </mesh>
          </group>
        )
      })()}

      {/* ── Cursor wireframe case survolée en mode déplacement combat ────── */}
      {combatMoveMode && combatCursorPos && (
        <mesh
          position={[combatCursorPos.x + 0.5, 0.1, combatCursorPos.z + 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#ffffff" wireframe />
        </mesh>
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
// combatMoveMode : { tokenId, allures, onMoveSelected, onCancel } | null — sélection destination combat
export default function Canvas3D({ onTokenDoubleClick, socket, onEntityClick, onTokenRotate, moveTarget, onMoveCancel, dicePayload, onDiceDone, combatCameraCenter, combatMoveMode }) {
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
        />
      )}
    </Canvas>
  )
}
