import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { MapControls, Grid, Text } from '@react-three/drei'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import { loadVoxelTextures } from '../lib/voxelTextures.js'
import Voxel from './Voxel.jsx'
import EntityMesh from './EntityMesh.jsx'
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

// loadVoxelTextures importé depuis ../lib/voxelTextures.js
// — partagé avec Editor3D pour éviter la duplication et garantir la cohérence.

// Voxel importé depuis ./Voxel.jsx — partagé avec Editor3D.

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

  // useGLTF suspend le composant le temps du chargement (géré nativement par Canvas R3F).
  // La référence gltf est stable entre les renders pour une même URL (cache suspend-react).
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
    <group
      position={[x, y, z]}
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
  altPressed, onEntityClick,
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
  // battlemapId en dépendance — les handlers capturent battlemapId en closure.
  // Sans battlemapId dans les deps, handleVoxelUpdated garderait l'ancien ID après MAP_SWITCH.
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
      // Filtrer les events d'autres battlemaps — guard race condition MAP_SWITCH
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
  }, [raycastGround, getColumnTopY])

  // ─── Fin du drag ──────────────────────────────────────────────────────────
  // updateToken appelé directement depuis le store — pas de callback onTokenMove.
  const handlePointerUp = useCallback(async (e) => {
    if (!dragRef.current.active) return

    const wasMoving = dragRef.current.hasMoved
    const token = dragRef.current.token

    if (orbitRef.current) orbitRef.current.enabled = true
    dragRef.current.active = false
    dragRef.current.hasMoved = false
    setDragState(null)

    if (!wasMoving) {
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
  }, [raycastGround, getColumnTopY, onTokenSelect, updateToken, isGm, justSelectedRef])

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
  // removeToken appelé directement depuis le store — pas de callback onTokenDelete.
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

      {tokens.filter(token => isGm || token.layer !== 'gm').map(token => {
        // Résolution de l'URL GLB depuis le character associé.
        // Si le character a un glb_url (chemin MinIO), on construit l'URL proxy.
        // Sinon fallback sur default.glb.
        // Le ?v= éventuel dans glb_url assure le cache busting de useGLTF.
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
    </>
  )
}

// ─── Composant principal exporté ──────────────────────────────────────────────
// Canvas3D — lecture seule (mode jeu).
// La logique d'édition est dans Editor3D (session 9A-3).
// Props supprimées en 9A-2 : mode, activeMaterial, onPackLoaded
// Props conservées : onTokenDoubleClick, socket
// Props ajoutées : onEntityClick
export default function Canvas3D({ onTokenDoubleClick, socket, onEntityClick }) {
  const { battlemap } = useMapStore()
  const { entities } = useEntityStore()

  const [voxels, setVoxels] = useState({})
  const [textureMaterials, setTextureMaterials] = useState({})  // { [texId]: { faceMaterials } } — voxels uniquement
  const [entityTextureMaterials, setEntityTextureMaterials] = useState({})  // { [bp.id]: { base, states } }
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

  const justSelectedRef = useRef(false)

  // blueprintIds — chaîne stable des IDs de blueprints uniques présents sur la carte.
  // Utilisée comme dépendance du useEffect de chargement des textures entités pour éviter
  // un rechargement à chaque mise à jour WS (ENTITY_MOVED, etc.) qui recrée le tableau
  // entities sans changer les blueprints nécessaires.
  const blueprintIds = [...new Set(entities.map(e => e.blueprint_id))].sort().join(',')

  // ─── Initialisation voxels depuis battlemap.voxel_data ────────────────────
  // Format base après migration 30 : { "x:y:z": { tex, geo, r } }
  // Format mémoire React : { "x:y:z": { x, y, z, tex, geo, r } }
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
  // Charge les IDs présents dans voxel_data — séparé du chargement entités (PEF6).
  // Guard P26 : si 0 textures → setBlocksReady(true) immédiatement (carte vide).
  useEffect(() => {
    const loadBlocks = async () => {
      setBlocksReady(false)

      // ── Voxels ────────────────────────────────────────────────────────────
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

      // ── Entités — fakeTexObjs depuis geometry.faces (chemins PNG) ─────────
      // PEF5 : skip les blueprints sans pack_id
      // PEF6 : chargement séparé — n'utilise pas /voxel-textures?ids=
      const fakeTexObjs = []
      for (const entity of entities) {
        const bp = entity.blueprint
        if (!bp?.pack_id) continue               // PEF5
        if (!bp.geometry?.faces) continue

        // Jeu de base
        fakeTexObjs.push({
          id: `${bp.id}__base`,
          pack_id: bp.pack_id,
          faces: bp.geometry.faces,
        })

        // Un jeu par état avec face_overrides fusionnés
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
          // Restructurer en { [bp.id]: { base, states: { [stateId]: ... } } }
          const structured = {}
          for (const entity of entities) {
            const bp = entity.blueprint
            if (!bp?.pack_id) continue                    // PEF5
            if (structured[bp.id]) continue               // déjà traité (plusieurs instances du même blueprint)
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
        />
      )}
    </Canvas>
  )
}
