import { useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { MapControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import { loadVoxelTextures } from '../lib/voxelTextures.js'
import Voxel from './Voxel.jsx'
import EntityMesh from './EntityMesh.jsx'
import { useMapStore } from '../stores/mapStore'
import { useEntityStore } from '../stores/entityStore'
// ─── Constantes — identiques à Canvas3D ──────────────────────────────────────
const GRID_SIZE = 50

// ─── Utilitaire clé voxel ────────────────────────────────────────────────────
const getVoxelKey = (x, y, z) => `${x}:${y}:${z}`

// ─── Ghost voxel — preview avant pose ────────────────────────────────────────
// Mesh semi-transparent sous le curseur, géométrie du bloc actif.
// Couleur unie bleue — pas les textures (lisibilité maximale).
function GhostVoxel({ position, geometry, rotation }) {
  if (!position) return null
  const [px, py, pz] = position
  const rot = (rotation || 0) * (Math.PI / 2)

  const geo = geometry || 'cube'

  const yOffset = geo === 'slab_bottom' ? -0.25
    : geo === 'slab_top' ? 0.25
    : 0

  const renderGeometry = () => {
    switch (geo) {
      case 'slab_bottom':
      case 'slab_top':
        return <boxGeometry args={[1, 0.5, 1]} />
      default:
        return <boxGeometry args={[1, 1, 1]} />
    }
  }

  return (
    <mesh
      position={[px + 0.5, py + 0.5 + yOffset, pz + 0.5]}
      rotation={[0, rot, 0]}
    >
      {renderGeometry()}
      <meshLambertMaterial color="#5b8dee" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  )
}

// ─── Ghost entité — preview avant pose ───────────────────────────────────────
function GhostEntity({ position, blueprint, r }) {
  if (!position || !blueprint) return null
  const { x, y, z } = position
  const rot = r * (Math.PI / 2)
  const width  = blueprint.geometry?.width  ?? 1
  const height = blueprint.geometry?.height ?? 1
  const depth  = blueprint.geometry?.depth  ?? 1
  return (
    <mesh position={[x + width / 2, y + height / 2, z + depth / 2]} rotation={[0, rot, 0]}>
      <boxGeometry args={[width, height, depth]} />
      <meshLambertMaterial color="#5b8dee" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  )
}

// ─── Scène éditeur entités ────────────────────────────────────────────────────
function EntityEditorScene({ voxels, textureMaterials, entityTextureMaterials, socket, battlemapId, activeBlueprint }) {
  const { camera, gl, scene } = useThree()
  const orbitRef = useRef()
  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const mousePosRef = useRef({ x: 0, y: 0 })
  const { entities, blueprints, addEntity, removeEntity } = useEntityStore()
  const [ghostPos, setGhostPos] = useState(null)
  const [ghostR, setGhostR] = useState(0)

  const calcEntityPos = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)

    // Raycasting voxels en priorité — pose sur la face supérieure d'un voxel existant
    const meshes = []
    scene.traverse(obj => { if (obj.userData.isVoxel && obj.isMesh) meshes.push(obj) })
    const hits = raycaster.intersectObjects(meshes, false)
    if (hits.length > 0) {
      const hit = hits[0]
      const normal = hit.face.normal.clone().applyQuaternion(hit.object.getWorldQuaternion(new THREE.Quaternion())).round()
      // Pour les entités : on pose sur le sol au pied du voxel touché, pas sur la face
      // La coordonnée Y = face supérieure du voxel (top face uniquement)
      const [vx, vy, vz] = hit.object.userData.position
      const ny = vy + Math.round(normal.y)  // 0 si face latérale, vy+1 si face top
      const finalY = Math.max(0, normal.y > 0 ? ny : vy)
      const x = Math.round(hit.point.x)
      const z = Math.round(hit.point.z)
      if (Math.abs(x) > GRID_SIZE / 2 || Math.abs(z) > GRID_SIZE / 2) return null
      return { x, y: finalY, z }
    }

    // Fallback — intersection avec le sol Y=0
    const target = new THREE.Vector3()
    const hit2 = raycaster.ray.intersectPlane(groundPlane, target)
    if (!hit2) return null
    const x = Math.round(target.x)
    const z = Math.round(target.z)
    if (Math.abs(x) > GRID_SIZE / 2 || Math.abs(z) > GRID_SIZE / 2) return null
    return { x, y: 0, z }
  }, [camera, gl, scene])

  const getEntityUnderCursor = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const meshes = []
    scene.traverse(obj => { if (obj.userData.isEntity && obj.isMesh) meshes.push(obj) })
    const hits = raycaster.intersectObjects(meshes, false)
    return hits.length > 0 ? hits[0].object.userData.entityId : null
  }, [camera, gl, scene])

  useEffect(() => {
    const canvas = gl.domElement
    const onMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY }
      if (!activeBlueprint?.id) { setGhostPos(null); return }
      setGhostPos(calcEntityPos(e.clientX, e.clientY))
    }
    canvas.addEventListener('mousemove', onMove)
    return () => canvas.removeEventListener('mousemove', onMove)
  }, [gl, activeBlueprint?.id, calcEntityPos])

  useEffect(() => {
    const canvas = gl.domElement
    const onMouseDown = async (e) => {
      if (e.button !== 0) return
      if (!activeBlueprint?.id || !battlemapId) return
      const pos = calcEntityPos(e.clientX, e.clientY)
      if (!pos) return
      try {
        const res = await api.post(`/battlemaps/${battlemapId}/entities`, {
          blueprint_id: activeBlueprint.id,
          pos_x: pos.x, pos_y: pos.z, pos_z: pos.y, r: ghostR, // PE14
        })
        addEntity(res.data.entity)   // mise à jour store locale immédiate
        socket?.emit(WS.ENTITY_CREATED, { entityId: res.data.entity.id })
      } catch (err) { console.error('[EntityEditor] Erreur pose entité :', err) }
    }
    canvas.addEventListener('mousedown', onMouseDown)
    return () => canvas.removeEventListener('mousedown', onMouseDown)
  }, [gl, activeBlueprint?.id, battlemapId, ghostR, calcEntityPos, socket])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'r' && e.key !== 'R') return
      const entityId = getEntityUnderCursor(mousePosRef.current.x, mousePosRef.current.y)
      if (entityId) {
        const entity = entities.find(en => en.id === entityId)
        if (!entity) return
        const newR = (entity.r + 1) % 4
        api.put(`/entities/${entityId}`, { r: newR })
          .then(res => socket?.emit(WS.ENTITY_MOVED, {
            entityId, pos_x: res.data.entity.pos_x,
            pos_y: res.data.entity.pos_y, pos_z: res.data.entity.pos_z, r: newR,
          }))
          .catch(err => console.error('[EntityEditor] Erreur rotation :', err))
      } else {
        setGhostR(prev => (prev + 1) % 4)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [entities, getEntityUnderCursor, socket, battlemapId])

  // ─── Suppression entité — touche Delete/Backspace ───────────────────────
  // Entité sous le curseur → DELETE REST → removeEntity + WS.
  useEffect(() => {
    const onKey = async (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const entityId = getEntityUnderCursor(mousePosRef.current.x, mousePosRef.current.y)
      if (!entityId) return
      try {
        await api.delete(`/entities/${entityId}`)
        removeEntity(entityId)
        socket?.emit(WS.ENTITY_DELETED, { entityId })
      } catch (err) { console.error('[EntityEditor] Erreur suppression entité :', err) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [getEntityUnderCursor, removeEntity, socket])

  useEffect(() => {
    const canvas = gl.domElement
    const prevent = (e) => e.preventDefault()
    canvas.addEventListener('contextmenu', prevent)
    return () => canvas.removeEventListener('contextmenu', prevent)
  }, [gl])

  useEffect(() => {
    if (!orbitRef.current) return
    orbitRef.current.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }
    orbitRef.current.listenToKeyEvents(window)
    orbitRef.current.keyPanSpeed = 20
  }, [])

  return (
    <>
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#ffffff', '#334155', 0.6]} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.6} />
      <MapControls ref={orbitRef}
        mouseButtons={{ LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
        enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI / 2}
      />
      <Grid args={[GRID_SIZE, GRID_SIZE]} position={[0, 0, 0]}
        cellColor="#334155" sectionColor="#475569" fadeDistance={80}
      />
      {Object.values(voxels).map(v => (
        <Voxel key={getVoxelKey(v.x, v.y, v.z)}
          position={[v.x, v.y, v.z]} textureMaterials={textureMaterials[v.tex]}
          geometry={v.geo} rotation={v.r}
        />
      ))}
      {entities.map(entity => {
        const blueprint = blueprints[entity.blueprint_id]
        if (!blueprint) return null
        return (
          <EntityMesh key={entity.id} entity={entity} blueprint={blueprint}
            entityTextureMaterials={entityTextureMaterials} altPressed={false} isGmOnly={entity.gm_only}
          />
        )
      })}
      {ghostPos && activeBlueprint && blueprints[activeBlueprint.id] && (
        <GhostEntity position={ghostPos} blueprint={blueprints[activeBlueprint.id]} r={ghostR} />
      )}
    </>
  )
}

// ─── Scène éditeur ────────────────────────────────────────────────────────────
// Lecture des voxels depuis les props — écriture via setVoxels + socket.emit.
function EditorScene({
  voxels, setVoxels, textureMaterials,
  activeMaterial, onActiveMaterialChange,
  socket, battlemapId,
  isDirty,
}) {
  const { camera, gl, scene } = useThree()
  const orbitRef = useRef()
  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  // Position courante de la souris — nécessaire pour handleKeyDown (pas de e.clientX)
  const mousePosRef = useRef({ x: 0, y: 0 })

  // Position du ghost voxel — null = pas affiché
  const [ghostPos, setGhostPos] = useState(null)

  // ─── Pan clavier proportionnel à la hauteur caméra ──────────────────────
  // Remplace listenToKeyEvents + keyPanSpeed de MapControls.
  // Vitesse native MapControls = pixels écran, indépendante du zoom.
  // Solution : vitesse = camera.position.y * PAN_FACTOR * delta — linéaire à toutes altitudes.
  const keysPressed = useRef(new Set())
  const PAN_FACTOR = 0.8

  useEffect(() => {
    const onKeyDown = (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault()
        keysPressed.current.add(e.key)
      }
    }
    const onKeyUp = (e) => keysPressed.current.delete(e.key)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useFrame((_, delta) => {
    if (keysPressed.current.size === 0) return
    if (!orbitRef.current) return
    const speed = Math.max(camera.position.y, 2) * PAN_FACTOR * delta
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
    const move = new THREE.Vector3()
    if (keysPressed.current.has('ArrowUp'))    move.addScaledVector(forward,  speed)
    if (keysPressed.current.has('ArrowDown'))  move.addScaledVector(forward, -speed)
    if (keysPressed.current.has('ArrowLeft'))  move.addScaledVector(right,   -speed)
    if (keysPressed.current.has('ArrowRight')) move.addScaledVector(right,    speed)
    camera.position.add(move)
    orbitRef.current.target.add(move)
  })

  // ─── Ref position mousedown droit — distingue clic court de drag caméra ─
  // Clic droit court (< 4px) = suppression voxel.
  // Drag droit = rotation caméra MapControls — pas de suppression.
  const rightDownRef = useRef(null)

  // ─── Calcul position ghost depuis la souris ─────────────────────────────
  // Raycasting sur les bbox isVoxel en priorité, sinon sur le sol (Y=0).
  // Retourne { x, y, z } en coordonnées brutes (entiers) ou null.
  const calcGhostPos = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)

    // Collecter toutes les bbox invisibles (userData.isVoxel)
    const meshes = []
    scene.traverse(obj => {
      if (obj.userData.isVoxel && obj.isMesh) meshes.push(obj)
    })

    const hits = raycaster.intersectObjects(meshes, false)
    if (hits.length > 0) {
      const hit = hits[0]
      const normal = hit.face.normal.clone().applyQuaternion(hit.object.getWorldQuaternion(new THREE.Quaternion())).round()
      const [vx, vy, vz] = hit.object.userData.position
      const nx = vx + Math.round(normal.x)
      const ny = vy + Math.round(normal.y)
      const nz = vz + Math.round(normal.z)
      // Guard dimensions
      if (Math.abs(nx) > GRID_SIZE / 2 || Math.abs(nz) > GRID_SIZE / 2 || ny < 0 || ny > 7) return null
      return { x: nx, y: ny, z: nz }
    }

    // Pas de voxel — intersection avec le sol Y=0
    const target = new THREE.Vector3()
    const hit2 = raycaster.ray.intersectPlane(groundPlane, target)
    if (!hit2) return null
    const x = Math.round(target.x)
    const z = Math.round(target.z)
    if (Math.abs(x) > GRID_SIZE / 2 || Math.abs(z) > GRID_SIZE / 2) return null
    return { x, y: 0, z }
  }, [camera, gl, scene])

  // ─── Raycasting voxel existant à une position souris ───────────────────
  // Retourne la position { x, y, z } du voxel touché ou null.
  const getVoxelUnderCursor = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const meshes = []
    scene.traverse(obj => {
      if (obj.userData.isVoxel && obj.isMesh) meshes.push(obj)
    })
    const hits = raycaster.intersectObjects(meshes, false)
    if (hits.length === 0) return null
    const pos = hits[0].object.userData.position
    return { x: pos[0], y: pos[1], z: pos[2] }
  }, [camera, gl, scene])

  // ─── Mouse move — mise à jour ghost + mémorisation position souris ──────
  useEffect(() => {
    const canvas = gl.domElement

    const handleMouseMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY }
      if (!activeMaterial) { setGhostPos(null); return }
      const pos = calcGhostPos(e.clientX, e.clientY)
      setGhostPos(pos)
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    return () => canvas.removeEventListener('mousemove', handleMouseMove)
  }, [gl, activeMaterial, calcGhostPos])

  // ─── Mouse down — pose gauche + mémorisation position droit ────────────
  // Clic gauche : pose immédiate du bloc actif.
  // Clic droit : mémorise la position pour décision au mouseup (clic court vs drag caméra).
  useEffect(() => {
    const canvas = gl.domElement

    const handleMouseDown = (e) => {
      // Clic droit — mémoriser la position, décision au mouseup
      if (e.button === 2) {
        rightDownRef.current = { x: e.clientX, y: e.clientY }
        return
      }

      // Clic gauche — pose du bloc actif
      if (e.button === 0) {
        if (!activeMaterial) return
        const pos = calcGhostPos(e.clientX, e.clientY)
        if (!pos) return
        const { x, y, z } = pos
        const { texId, geo, r } = activeMaterial
        const key = getVoxelKey(x, y, z)
        setVoxels(prev => ({ ...prev, [key]: { x, y, z, tex: texId, geo, r } }))
        isDirty.current = true
        if (!battlemapId) return  // P12
        socket?.emit(WS.VOXEL_ADD, { battlemapId, x, y, z, tex: texId, geo, r })
      }
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    return () => canvas.removeEventListener('mousedown', handleMouseDown)
  }, [gl, activeMaterial, calcGhostPos, setVoxels, socket, battlemapId, isDirty])

  // ─── Mouse up droit — suppression si clic court (pas un drag caméra) ────
  // Si la souris a bougé de moins de 4px depuis le mousedown → clic court → suppression.
  // Si la souris a bougé davantage → drag caméra MapControls → ignorer.
  useEffect(() => {
    const canvas = gl.domElement
    const DRAG_THRESHOLD = 4

    const handleMouseUp = (e) => {
      if (e.button !== 2) return
      if (!rightDownRef.current) return
      const dx = Math.abs(e.clientX - rightDownRef.current.x)
      const dy = Math.abs(e.clientY - rightDownRef.current.y)
      rightDownRef.current = null
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) return  // drag caméra — ignorer

      // Clic court — suppression du voxel sous le curseur
      const hit = getVoxelUnderCursor(e.clientX, e.clientY)
      if (!hit) return
      const { x, y, z } = hit
      const key = getVoxelKey(x, y, z)
      if (!voxels[key]) return
      setVoxels(prev => { const next = { ...prev }; delete next[key]; return next })
      isDirty.current = true
      if (!battlemapId) return  // P12
      socket?.emit(WS.VOXEL_REMOVE, { battlemapId, x, y, z })
    }

    canvas.addEventListener('mouseup', handleMouseUp)
    return () => canvas.removeEventListener('mouseup', handleMouseUp)
  }, [gl, getVoxelUnderCursor, voxels, setVoxels, socket, battlemapId, isDirty])

  // ─── Contextmenu prevent — clic droit sans menu browser ─────────────────
  useEffect(() => {
    const canvas = gl.domElement
    const prevent = (e) => e.preventDefault()
    canvas.addEventListener('contextmenu', prevent)
    return () => canvas.removeEventListener('contextmenu', prevent)
  }, [gl])

  // ─── Keyboard — touche R (rotation ghost ou voxel existant) + 1-9,0 ────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ── Touche R — rotation ──────────────────────────────────────────────
      if (e.key === 'r' || e.key === 'R') {
        // Vérifier si un voxel est sous le curseur
        const hit = getVoxelUnderCursor(mousePosRef.current.x, mousePosRef.current.y)
        if (hit) {
          // Rotation en place du voxel existant
          const { x, y, z } = hit
          const key = getVoxelKey(x, y, z)
          if (!voxels[key]) return
          const newR = (voxels[key].r + 1) % 4
          setVoxels(prev => ({ ...prev, [key]: { ...prev[key], r: newR } }))
          isDirty.current = true
          if (!battlemapId) return  // P12
          socket?.emit(WS.VOXEL_UPDATE, { battlemapId, x, y, z, r: newR })
        } else {
          // Rotation du ghost (bloc actif)
          if (!activeMaterial) return
          onActiveMaterialChange(prev => prev ? { ...prev, r: (prev.r + 1) % 4 } : prev)
        }
        return
      }

      // ── Raccourcis 1-9, 0 — sélection rapide palette ────────────────────
      // Ces raccourcis sont gérés dans Editor3D (niveau composant principal)
      // via onActiveMaterialChange — voir handleKeyDown dans Editor3D.
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [getVoxelUnderCursor, voxels, setVoxels, socket, battlemapId, activeMaterial, onActiveMaterialChange, isDirty])

  // ─── MapControls — configuration identique à Canvas3D ───────────────────
  // listenToKeyEvents et keyPanSpeed supprimés — remplacés par pan clavier custom (useFrame).
  useEffect(() => {
    if (!orbitRef.current) return
    orbitRef.current.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    }
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

      {/* Voxels existants */}
      {Object.values(voxels).map(v => (
        <Voxel
          key={getVoxelKey(v.x, v.y, v.z)}
          position={[v.x, v.y, v.z]}
          textureMaterials={textureMaterials[v.tex]}
          geometry={v.geo}
          rotation={v.r}
        />
      ))}

      {/* Ghost voxel — preview pose */}
      <GhostVoxel
        position={ghostPos ? [ghostPos.x, ghostPos.y, ghostPos.z] : null}
        geometry={activeMaterial?.geo || 'cube'}
        rotation={activeMaterial?.r || 0}
      />
    </>
  )
}

// ─── Composant principal exporté ──────────────────────────────────────────────
// Editor3D — mode édition GM.
// Gère : chargement blocs, voxels, save, raccourcis clavier sélection palette.
// Props :
//   socket                  — pour émettre VOXEL_ADD/REMOVE/UPDATE
//   activeMaterial          — { texId, geo, r } | null — texture+géométrie actifs (depuis SessionPage)
//   onActiveMaterialChange  — setter (depuis SessionPage)
//   availableBlocks         — tableau de blocs chargés (pour raccourcis 1-9)
//   onBlocksLoaded          — callback appelé quand les blocs sont chargés
export default function Editor3D({
  socket,
  activeMaterial,
  onActiveMaterialChange,
  availableBlocks,
  onBlocksLoaded,
  activeEditorTab,
  activeBlueprint,
}) {
  const { battlemap, setBattlemap } = useMapStore()
  const { entities } = useEntityStore()
  const [entityTextureMaterials, setEntityTextureMaterials] = useState({})

  const [voxels, setVoxels] = useState({})
  const [textureMaterials, setTextureMaterials] = useState({})
  const [blocksReady, setBlocksReady] = useState(false)

  const isDirty = useRef(false)
  const saveTimer = useRef(null)
  // voxelsRef — miroir de voxels pour accès dans le cleanup useEffect (évite le stale closure)
  const voxelsRef = useRef(voxels)
  useEffect(() => { voxelsRef.current = voxels }, [voxels])
  // battlemapRef — miroir de battlemap pour saveFireAndForget stable (pas de recréation du timer)
  const battlemapRef = useRef(battlemap)
  useEffect(() => { battlemapRef.current = battlemap }, [battlemap])

  // ─── Initialisation voxels depuis battlemap.voxel_data ──────────────────
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
  }, [battlemap?.id])

  // ─── Chargement voxel_textures — TOUTES les textures (palette complète) ──
  // Editor3D charge toutes les textures non-deprecated pour la palette,
  // contrairement à Canvas3D qui charge seulement les IDs présents dans voxel_data.
  // Un seul chargement couvre à la fois la palette et les voxels existants.
  useEffect(() => {
    const loadBlocks = async () => {
      setBlocksReady(false)
      try {
        const { data } = await api.get('/voxel-textures')
        onBlocksLoaded?.(data.textures)
        const loaded = await loadVoxelTextures(data.textures)
        setTextureMaterials(loaded)
      } catch (err) {
        console.error('[Editor3D] Erreur chargement voxel_textures :', err)
      } finally {
        setBlocksReady(true)
      }
    }
    loadBlocks()
  }, [battlemap?.id])

  // ─── Chargement entityTextureMaterials — même pattern que Canvas3D ────────
  // Dépendance sur blueprintIds (chaîne triée) — se redéclenche uniquement si un
  // nouveau blueprint apparaît, pas à chaque pose d'instance. PEF5/PEF6.
  const blueprintIds = [...new Set(entities.map(e => e.blueprint_id))].sort().join(',')
  useEffect(() => {
    if (entities.length === 0) { setEntityTextureMaterials({}); return }
    const load = async () => {
      const fakeTexObjs = []
      for (const entity of entities) {
        const bp = entity.blueprint
        if (!bp?.pack_id) continue
        if (!bp.geometry?.faces) continue
        fakeTexObjs.push({ id: `${bp.id}__base`, pack_id: bp.pack_id, faces: bp.geometry.faces })
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
      if (fakeTexObjs.length === 0) { setEntityTextureMaterials({}); return }
      try {
        const flat = await loadVoxelTextures(fakeTexObjs)
        const structured = {}
        for (const entity of entities) {
          const bp = entity.blueprint
          if (!bp?.pack_id) continue
          if (structured[bp.id]) continue
          structured[bp.id] = { base: flat[`${bp.id}__base`] || null, states: {} }
          for (const state of bp.states || []) {
            const key = `${bp.id}__state_${state.id}`
            if (flat[key]) structured[bp.id].states[state.id] = flat[key]
          }
        }
        setEntityTextureMaterials(structured)
      } catch (err) {
        console.error('[Editor3D] Erreur chargement entités textures :', err)
      }
    }
    load()
  // blueprintIds est une chaîne dérivée de entities — dépendance stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprintIds])

  // ─── Helper save synchrone — fire-and-forget ────────────────────────────
  // Utilisé dans les contextes où async ne peut pas être attendu
  // (cleanup useEffect, setInterval).
  // Construit le payload et lance fetch sans await — le navigateur complète
  // la requête en arrière-plan même après le démontage React.
  const saveFireAndForget = useCallback((currentVoxels) => {
    const bm = battlemapRef.current
    if (!isDirty.current || !bm?.id) return
    const payload = {}
    for (const [key, v] of Object.entries(currentVoxels)) {
      payload[key] = { tex: v.tex, geo: v.geo, r: v.r }
    }
    fetch(`${import.meta.env.VITE_API_URL}/api/battlemaps/${bm.id}/voxels`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ voxel_data: payload }),
    })
      .then(() => {
        isDirty.current = false
        setBattlemap({ ...battlemapRef.current, voxel_data: payload })
      })
      .catch(err => console.error('[Editor3D] Sauvegarde échouée :', err))
  }, [setBattlemap])

  // ─── save() async — pour les saves explicites futures (undo/redo) ────────
  // Payload format : { "x:y:z": { tex, geo, r } } — P_voxel_save_payload
  const save = useCallback(async (currentVoxels) => {
    if (!isDirty.current || !battlemap?.id) return
    try {
      const payload = {}
      for (const [key, v] of Object.entries(currentVoxels)) {
        payload[key] = { tex: v.tex, geo: v.geo, r: v.r }
      }
      await api.put(`/battlemaps/${battlemap.id}/voxels`, { voxel_data: payload })
      isDirty.current = false
      setBattlemap({ ...battlemap, voxel_data: payload })
    } catch (err) {
      console.error('[Editor3D] Erreur sauvegarde voxels :', err)
    }
  }, [battlemap, setBattlemap])

  // ─── Auto-save toutes les 60s si dirty ──────────────────────────────────
  useEffect(() => {
    saveTimer.current = setInterval(() => {
      saveFireAndForget(voxelsRef.current)
    }, 60000)
    return () => clearInterval(saveTimer.current)
  }, [saveFireAndForget])

  // ─── Save au démontage (toggle retour mode jeu) ──────────────────────────
  // Utilise saveFireAndForget — le cleanup useEffect ne peut pas await une Promise.
  // battlemap.id en dépendance (pas saveFireAndForget) pour éviter une re-exécution
  // au changement de battlemap qui démonterait/remonterait inutilement.
  useEffect(() => {
    return () => {
      saveFireAndForget(voxelsRef.current)
    }
  }, [saveFireAndForget])

  // ─── Raccourcis Digit1-5 — sélection géométrie ──────────────────────────
  // Digit1=cube, Digit2=slab_bottom, Digit3=slab_top, Digit4=slope, Digit5=wedge.
  // Modifient geo dans activeMaterial sans changer texId ni r.
  // Guard allowed_geometries : si la texture active restreint les géométries,
  // les géométries non autorisées sont ignorées silencieusement (P34).
  // Utilise e.code (invariant layout) — P38.
  const GEOMETRIES = ['cube', 'slab_bottom', 'slab_top', 'slope', 'wedge']

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code >= 'Digit1' && e.code <= 'Digit5') {
        e.preventDefault()  // empêcher les raccourcis navigateur (ex: recherche rapide Firefox)
        const idx = parseInt(e.code.replace('Digit', '')) - 1
        const geo = GEOMETRIES[idx]
        if (!activeMaterial) return
        // Guard allowed_geometries — null = toutes autorisées (P34)
        const texDef = availableBlocks?.find(t => t.id === activeMaterial.texId)
        const allowed = texDef?.allowed_geometries
        if (allowed !== null && allowed !== undefined && !allowed.includes(geo)) return
        onActiveMaterialChange(prev => prev ? { ...prev, geo } : prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [availableBlocks, onActiveMaterialChange, activeMaterial])

  return (
    <Canvas
      camera={{ position: [15, 15, 15], fov: 60 }}
      style={{ background: '#0f172a' }}
      onCreated={({ gl }) => { gl.shadowMap.enabled = true }}
    >
      {blocksReady && activeEditorTab === 'entity' && (
        <EntityEditorScene
          voxels={voxels}
          textureMaterials={textureMaterials}
          entityTextureMaterials={entityTextureMaterials}
          socket={socket}
          battlemapId={battlemap?.id}
          activeBlueprint={activeBlueprint}
        />
      )}
      {blocksReady && activeEditorTab !== 'entity' && (
        <EditorScene
          voxels={voxels}
          setVoxels={setVoxels}
          textureMaterials={textureMaterials}
          activeMaterial={activeMaterial}
          onActiveMaterialChange={onActiveMaterialChange}
          socket={socket}
          battlemapId={battlemap?.id}
          isDirty={isDirty}
        />
      )}
    </Canvas>
  )
}
