import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { MapControls, Grid, Text } from '@react-three/drei'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'

// ─── Constantes ───────────────────────────────────────────────────────────────
const VOXEL_SIZE = 1
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

// ─── Chargement des textures ──────────────────────────────────────────────────
const textureCache = {}

async function loadPackTextures(pack) {
  const loader = new THREE.TextureLoader()
  const textures = {}

  for (const mat of pack.materials) {
    const loadTex = (path) => new Promise((resolve) => {
      const url = `${import.meta.env.VITE_API_URL}/api/textures/${pack.name}/${path}`
      if (textureCache[url]) return resolve(textureCache[url])
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.magFilter = THREE.NearestFilter
        tex.minFilter = THREE.NearestFilter
        textureCache[url] = tex
        resolve(tex)
      }, undefined, () => resolve(null))
    })

    const top = await loadTex(mat.top)
    const side = mat.side !== mat.top ? await loadTex(mat.side) : top

    textures[mat.id] = [side, side, top, top, side, side].map(tex =>
      new THREE.MeshLambertMaterial({ map: tex, color: tex ? 0xffffff : 0x888888 })
    )
  }

  return textures
}

// ─── Voxel individuel ─────────────────────────────────────────────────────────
function Voxel({ position, materialId, materials }) {
  const mats = materials[materialId]
  if (!mats) return null
  return (
    <mesh position={[position[0] + 0.5, position[1] + 0.5, position[2] + 0.5]} userData={{ isVoxel: true, position }}>
      <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
      {mats.map((mat, i) => <meshLambertMaterial key={i} attach={`material-${i}`} {...mat} />)}
    </mesh>
  )
}

// ─── Anneau de base du token ──────────────────────────────────────────────────
// Toujours visible, ancré aux pieds du token (Y=0.1 local, indépendant de l'altitude).
// État normal : statique, opacité faible.
// État sélectionné : oscille en hauteur et en diamètre via useFrame.
// Logique : le group du token est positionné à son altitude en Y monde.
// L'anneau à position Y=0.1 local est donc toujours à "pied du token + 0.1" — correct.
function TokenRing({ color, isSelected, isDragging }) {
  const ringRef = useRef()
  const t = useRef(0)

  // Au repos/sélection : anneau à 0.6 (au-dessus des pieds du modèle, Y_OFFSET=0.5)
  // Pendant le drag : anneau à 0.1 (au ras du sol, aide à viser la case cible)
  const baseY = isDragging ? 0.1 : 0.6

  useFrame((_, delta) => {
    if (!ringRef.current) return
    if (!isSelected) {
      ringRef.current.position.y = baseY
      ringRef.current.scale.setScalar(1)
      ringRef.current.material.opacity = 0.5
      return
    }
    t.current += delta
    const time = t.current
    ringRef.current.position.y = baseY + Math.sin(time * 3) * 0.05
    const s = 1 + Math.sin(time * 2.5) * 0.08
    ringRef.current.scale.set(s, 1, s)
    ringRef.current.material.opacity = 0.7 + Math.sin(time * 4) * 0.25
  })

  return (
    <mesh ref={ringRef} position={[0, baseY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.58, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
    </mesh>
  )
}

// ─── Token individuel ─────────────────────────────────────────────────────────
// Pendant le drag : XZ depuis dragState (plan Y=0), Y = columnY + DRAG_HOVER.
// TokenRing : anneau toujours visible, animé à la sélection.
const Y_OFFSET = 0.5

function TokenMesh({ token, gltfScene, isSelected, onDragStart, onTokenDoubleClick, dragState }) {
  const color = token.color || '#4A90D9'
  const label = token.label || '?'

  const baseX = token.pos_x ?? 0
  const baseY = token.pos_z ?? 0   // pos_z base = altitude Y Three.js
  const baseZ = token.pos_y ?? 0   // pos_y base = axe Z Three.js

  const isDragging = dragState !== null
  const x = isDragging ? dragState.x + 0.5 : baseX + 0.5
  const y = isDragging ? dragState.y : baseY + 0.5
  const z = isDragging ? dragState.z + 0.5 : baseZ + 0.5

  const tiltX = isDragging ? dragState.tiltX : 0
  const tiltZ = isDragging ? dragState.tiltZ : 0

  const clonedScene = useMemo(() => {
    if (!gltfScene) return null
    const clone = SkeletonUtils.clone(gltfScene)
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach(mat => {
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace
            mat.map.needsUpdate = true
          }
          mat.needsUpdate = true
        })
      }
    })
    return clone
  }, [gltfScene])

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
      {/* Anneau toujours visible — animé si sélectionné, bas si drag */}
      <TokenRing color={color} isSelected={isSelected} isDragging={isDragging} />

      {/* Modèle 3D — incliné pendant le drag */}
      <primitive
        object={clonedScene}
        position={[0, Y_OFFSET, 0]}
        scale={[1, 1, 1]}
        rotation={[tiltX, 0, tiltZ]}
      />

      {/* Label flottant */}
      <Text
        position={[0, 2.5, 0]}
        font={FONT_URL}
        fontSize={0.3}
        color={color}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.04}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  )
}

// ─── Scène principale ─────────────────────────────────────────────────────────
function Scene({
  voxels, setVoxels, mode, activeMaterial,
  materials, onDirty, socket, battlemapId,
  tokens, selectedTokenId, onTokenSelect,
  gltfScene, onTokenMove, onTokenDelete, onTokenDoubleClick, isGm, justSelectedRef,
  user, characters,
}) {
  const { camera, gl, scene } = useThree()
  const orbitRef = useRef()
  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  // dragState : { tokenId, x, y, z, tiltX, tiltZ }
  // y = columnTopY + DRAG_HOVER — altitude dynamique pendant le drag
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

  // ─── Écoute voxels temps réel ──────────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    const handleVoxelAdded = ({ x, y, z, mat }) => {
      const key = getVoxelKey(x, y, z)
      setVoxels(prev => ({ ...prev, [key]: { x, y, z, mat } }))
    }
    const handleVoxelRemoved = ({ x, y, z }) => {
      const key = getVoxelKey(x, y, z)
      setVoxels(prev => { const next = { ...prev }; delete next[key]; return next })
    }
    socket.on(WS.VOXEL_ADDED, handleVoxelAdded)
    socket.on(WS.VOXEL_REMOVED, handleVoxelRemoved)
    return () => {
      socket.off(WS.VOXEL_ADDED, handleVoxelAdded)
      socket.off(WS.VOXEL_REMOVED, handleVoxelRemoved)
    }
  }, [socket])

  // ─── Raycasting sur plan Y=0 ───────────────────────────────────────────────
  // Toujours sur le sol — précis, simple, approche Foundry VTT.
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

  // Trouve le Y le plus haut dans la colonne de voxels à (x, z).
  // Retourne -1 si colonne vide, ≥0 si voxel trouvé (Y brut en base).
  const getColumnTopY = useCallback((x, z) => {
    let maxY = -1
    for (const v of Object.values(voxels)) {
      if (v.x === x && v.z === z) maxY = Math.max(maxY, v.y)
    }
    return maxY
  }, [voxels])

  // ─── Début du drag ─────────────────────────────────────────────────────────
  // Clic gauche uniquement. Le clic droit est géré par MapControls (rotation).
  // Le double clic est géré séparément via onDoubleClick sur TokenMesh.
  const handleDragStart = useCallback((e, token) => {
    e.stopPropagation()
    if (e.nativeEvent.button !== 0) return // ignorer tout sauf clic gauche

    // Vérifier ownership : GM ou propriétaire du character lié au token
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

  // ─── Déplacement souris ────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current.active) return

    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY

    if (!dragRef.current.hasMoved) {
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
      dragRef.current.hasMoved = true
    }

    // Raycasting sur plan Y=0 — précis quelle que soit l'angle caméra
    const worldPos = raycastGround(e.clientX, e.clientY)
    if (!worldPos) return

    // Altitude dynamique : le token flotte au-dessus du sol local
    const snappedX = Math.round(worldPos.x)
    const snappedZ = Math.round(worldPos.z)
    const columnY = getColumnTopY(snappedX, snappedZ)

    // Calcul inclinaison
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

  // ─── Fin du drag ───────────────────────────────────────────────────────────
  // Le serveur broadcastera TOKEN_MOVED à toute la room — pas d'emit client.
  const handlePointerUp = useCallback(async (e) => {
    if (!dragRef.current.active) return

    const wasMoving = dragRef.current.hasMoved
    const token = dragRef.current.token

    if (orbitRef.current) orbitRef.current.enabled = true
    dragRef.current.active = false
    dragRef.current.hasMoved = false
    setDragState(null)

    if (!wasMoving) {
      // Clic court → sélection
      // justSelectedRef empêche handleCanvasClick d'effacer immédiatement la sélection
      justSelectedRef.current = true
      onTokenSelect(token.id)
      return
    }

    const worldPos = raycastGround(e.clientX, e.clientY)
    if (!worldPos) return

    const snappedX = Math.round(worldPos.x)
    const snappedZ = Math.round(worldPos.z)
    const snappedY = getColumnTopY(snappedX, snappedZ)

    // Validation : GM peut poser dans le vide (minY=-1) jusqu'au plafond (8).
    // Joueur : voxel obligatoire sous les pieds (minY=0) jusqu'à 7.
    const minY = isGm ? -1 : 0
    const maxY = isGm ? 8 : 7
    if (snappedY < minY || snappedY > maxY) return
    if (Math.abs(snappedX) > GRID_SIZE / 2 || Math.abs(snappedZ) > GRID_SIZE / 2) return

    const dbPos = threeToDb(snappedX, snappedY, snappedZ)

    try {
      const res = await api.put(`/tokens/${token.id}`, dbPos)
      onTokenMove(res.data.token)
    } catch (err) {
      console.error('Erreur déplacement token :', err)
    }
  }, [raycastGround, getColumnTopY, onTokenSelect, onTokenMove, isGm, justSelectedRef])

  // ─── Listeners DOM ────────────────────────────────────────────────────────
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
  // Écoute sur document (pas sur le canvas) pour capter la touche même sans focus 3D.
  // Le serveur broadcastera TOKEN_DELETED à toute la room — pas d'emit client.
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (!isGm) return
      if (!selectedTokenId) return
      try {
        await api.delete(`/tokens/${selectedTokenId}`)
        onTokenDelete(selectedTokenId)
      } catch (err) {
        console.error('Erreur suppression token :', err)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isGm, selectedTokenId, onTokenDelete])

  // ─── Gestion des clics voxel ───────────────────────────────────────────────
  const handleClick = useCallback((e) => {
    if (mode !== 'edit') return
    e.preventDefault()

    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)

    if (e.button === 2) {
      const meshes = []
      scene.traverse(obj => { if (obj.userData.isVoxel) meshes.push(obj) })
      const hits = raycaster.intersectObjects(meshes)
      if (hits.length === 0) return
      const hit = hits[0].object
      const [x, y, z] = hit.userData.position
      const key = getVoxelKey(x, y, z)
      setVoxels(prev => { const next = { ...prev }; delete next[key]; return next })
      onDirty()
      socket?.emit(WS.VOXEL_REMOVE, { battlemapId, x, y, z })
      return
    }

    if (e.button !== 0) return

    const meshes = []
    scene.traverse(obj => { if (obj.userData.isVoxel) meshes.push(obj) })
    const hits = raycaster.intersectObjects(meshes)

    let x, y, z
    if (hits.length > 0) {
      const hit = hits[0]
      const normal = hit.face.normal.clone().round()
      const [vx, vy, vz] = hit.object.userData.position
      x = vx + normal.x
      y = vy + normal.y
      z = vz + normal.z
    } else {
      const target = new THREE.Vector3()
      raycaster.ray.intersectPlane(groundPlane, target)
      if (!target) return
      x = Math.round(target.x)
      y = 0
      z = Math.round(target.z)
    }

    if (Math.abs(x) > GRID_SIZE / 2 || Math.abs(z) > GRID_SIZE / 2 || y < 0 || y > 7) return

    const key = getVoxelKey(x, y, z)
    setVoxels(prev => ({ ...prev, [key]: { x, y, z, mat: activeMaterial } }))
    onDirty()
    socket?.emit(WS.VOXEL_ADD, { battlemapId, x, y, z, mat: activeMaterial })
  }, [mode, activeMaterial, camera, gl, scene, socket, battlemapId])

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('mousedown', handleClick)
    return () => canvas.removeEventListener('mousedown', handleClick)
  }, [handleClick])

  useEffect(() => {
    const canvas = gl.domElement
    const prevent = (e) => { if (mode === 'edit') e.preventDefault() }
    canvas.addEventListener('contextmenu', prevent)
    return () => canvas.removeEventListener('contextmenu', prevent)
  }, [mode, gl])

  useEffect(() => {
    if (!orbitRef.current) return
    // Clic gauche : rien (tokens gèrent leurs propres events)
    // Molette enfoncée : pan
    // Clic droit : rotation orbitale (libéré pour le menu contextuel token)
    orbitRef.current.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    }
    // Pan clavier natif MapControls — touches directionnelles
    // Garde : ne pas bouger la caméra si un input/textarea est focus
    orbitRef.current.listenToKeyEvents(window)
    orbitRef.current.keyPanSpeed = 20
  }, [mode])

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
          materialId={v.mat}
          materials={materials}
        />
      ))}

      {gltfScene && tokens.map(token => (
        <TokenMesh
          key={token.id}
          token={token}
          gltfScene={gltfScene}
          isSelected={selectedTokenId === token.id}
          onDragStart={handleDragStart}
          onTokenDoubleClick={onTokenDoubleClick}
          dragState={dragState?.tokenId === token.id ? dragState : null}
        />
      ))}
    </>
  )
}

// ─── Composant principal exporté ──────────────────────────────────────────────
export default function Canvas3D({
  battlemap, tokens = [], mode, activeMaterial,
  onVoxelDataChange, onPackLoaded, onTokenMove, onTokenDelete, onTokenDoubleClick,
  isGm, socket, user, characters = [],
}) {
  const [voxels, setVoxels] = useState({})
  const [materials, setMaterials] = useState({})
  const [packsLoaded, setPacksLoaded] = useState(false)
  const [gltfScene, setGltfScene] = useState(null)
  const [selectedTokenId, setSelectedTokenId] = useState(null)
  const isDirty = useRef(false)
  const saveTimer = useRef(null)

  // Empêche handleCanvasClick d'effacer une sélection posée dans le même cycle
  const justSelectedRef = useRef(false)

  useEffect(() => {
    if (!battlemap?.voxel_data) return
    const map = {}
    for (const [key, mat] of Object.entries(battlemap.voxel_data)) {
      const [x, y, z] = key.split(':').map(Number)
      map[key] = { x, y, z, mat }
    }
    setVoxels(map)
  }, [battlemap?.id])

  useEffect(() => {
    api.get('/textures').then(async ({ data }) => {
      if (!data.packs?.length) return
      const pack = data.packs[0]
      const loaded = await loadPackTextures(pack)
      setMaterials(loaded)
      setPacksLoaded(true)
      onPackLoaded?.(pack.materials)
    }).catch(console.error)
  }, [])

  const GltfLoader = () => {
    const { scene } = useGLTF(DEFAULT_TOKEN_URL)
    useEffect(() => { if (scene) setGltfScene(scene) }, [scene])
    return null
  }

  const handleDirty = useCallback(() => { isDirty.current = true }, [])

  const save = useCallback(async (currentVoxels) => {
    if (!isDirty.current || !battlemap?.id) return
    try {
      // Convertir { "x:y:z": { x, y, z, mat } } → { "x:y:z": mat } avant persistance
      const payload = {}
      for (const [key, v] of Object.entries(currentVoxels)) payload[key] = v.mat
      await api.put(`/battlemaps/${battlemap.id}/voxels`, { voxel_data: payload })
      isDirty.current = false
      onVoxelDataChange?.(payload)
    } catch (err) {
      console.error('Erreur sauvegarde voxels :', err)
    }
  }, [battlemap?.id])

  useEffect(() => {
    saveTimer.current = setInterval(() => { if (isDirty.current) save(voxels) }, 60000)
    return () => clearInterval(saveTimer.current)
  }, [save, voxels])

  const prevMode = useRef(mode)
  useEffect(() => {
    if (prevMode.current === 'edit' && mode === 'play') save(voxels)
    prevMode.current = mode
  }, [mode, save, voxels])

  // Désélectionner en cliquant sur le vide
  // justSelectedRef évite d'écraser une sélection posée dans le même event cycle
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
      <GltfLoader />
      {packsLoaded && (
        <Scene
          voxels={voxels}
          setVoxels={setVoxels}
          mode={mode}
          activeMaterial={activeMaterial}
          materials={materials}
          onDirty={handleDirty}
          socket={socket}
          battlemapId={battlemap?.id}
          tokens={tokens}
          selectedTokenId={selectedTokenId}
          onTokenSelect={setSelectedTokenId}
          gltfScene={gltfScene}
          onTokenMove={onTokenMove}
          onTokenDelete={onTokenDelete}
          onTokenDoubleClick={onTokenDoubleClick}
          isGm={isGm}
          justSelectedRef={justSelectedRef}
          user={user}
          characters={characters}
        />
      )}
    </Canvas>
  )
}
