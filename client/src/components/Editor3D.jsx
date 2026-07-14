import { useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { MapControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import { loadVoxelTextures } from '../lib/voxelTextures.js'
import Voxel from './Voxel.jsx'
import EntityMesh from './EntityMesh.jsx'
import SurfaceEditorScene from './SurfaceEditorScene.jsx'
import SurfaceDungeonScene from './SurfaceDungeonScene.jsx'
import { hasSurfaceContent, normalizeSurfaceData } from '../lib/surfaceData.js'
import { useMapStore } from '../stores/mapStore'
import { useEntityStore } from '../stores/entityStore'
// ─── Constantes — identiques à Canvas3D ──────────────────────────────────────
const GRID_SIZE = 50

// ─── Utilitaire clé voxel ────────────────────────────────────────────────────
const getVoxelKey = (x, y, z) => `${x}:${y}:${z}`
const cloneSurfaceData = (data) => JSON.parse(JSON.stringify(data))

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
function EntityEditorScene({ voxels, surfaceData, textureMaterials, entityTextureMaterials, socket, battlemapId, activeBlueprint }) {
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
      {hasSurfaceContent(surfaceData) ? (
        <SurfaceDungeonScene
          surfaceData={surfaceData}
          textureMaterials={textureMaterials}
          showWater={false}
          ceilingOpacity={0.35}
        />
      ) : (
        Object.values(voxels).map(v => (
          <Voxel key={getVoxelKey(v.x, v.y, v.z)}
            position={[v.x, v.y, v.z]} textureMaterials={textureMaterials[v.tex]}
            geometry={v.geo} rotation={v.r}
          />
        ))
      )}
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

// ─── Composant principal exporté ──────────────────────────────────────────────
// Editor3D — mode édition GM.
// Gère : chargement blocs, voxels, surfaces (fusion Kiwi), save, raccourcis clavier.
// Props :
//   socket                  — pour émettre VOXEL_ADD/REMOVE/UPDATE + ENTITY_*
//   activeMaterial          — { texId, geo, r } | null — utilisé par la palette voxel legacy (onglet entité)
//   onActiveMaterialChange  — setter (depuis SessionPage)
//   availableBlocks         — tableau de blocs chargés (pour raccourcis)
//   onBlocksLoaded          — callback appelé quand les blocs sont chargés
//   surfaceTool             — état de l'outil de sculptage (mode/élévation/matériau...) — depuis SessionPage
//   surfaceUndoRequest/surfaceRedoRequest — compteurs incrémentés par la Sidebar (Ctrl+Z/Y)
//   onSurfaceUndoStateChange/onSurfaceRedoStateChange — callbacks pour activer/désactiver les boutons undo/redo
export default function Editor3D({
  socket,
  activeMaterial,
  availableBlocks,
  onBlocksLoaded,
  activeEditorTab,
  activeBlueprint,
  surfaceTool,
  surfaceUndoRequest = 0,
  surfaceRedoRequest = 0,
  onSurfaceUndoStateChange,
  onSurfaceRedoStateChange,
}) {
  const { battlemap, setBattlemap } = useMapStore()
  const { entities } = useEntityStore()
  const [entityTextureMaterials, setEntityTextureMaterials] = useState({})

  const [voxels, setVoxels] = useState({})
  const [surfaceData, setSurfaceData] = useState(() => normalizeSurfaceData(null))
  const [textureMaterials, setTextureMaterials] = useState({})
  const [blocksReady, setBlocksReady] = useState(false)

  const isDirty = useRef(false)
  const isSurfaceDirty = useRef(false)
  const saveTimer = useRef(null)
  const surfaceUndoStackRef = useRef([])
  const surfaceRedoStackRef = useRef([])
  const surfaceSaveQueueRef = useRef(Promise.resolve())
  const surfaceSaveRevisionRef = useRef(0)
  const [surfaceUndoDepth, setSurfaceUndoDepth] = useState(0)
  const [surfaceRedoDepth, setSurfaceRedoDepth] = useState(0)
  const surfaceUndoRequestRef = useRef(surfaceUndoRequest)
  const surfaceRedoRequestRef = useRef(surfaceRedoRequest)
  // voxelsRef — miroir de voxels pour accès dans le cleanup useEffect (évite le stale closure)
  const voxelsRef = useRef(voxels)
  useEffect(() => { voxelsRef.current = voxels }, [voxels])
  const surfaceDataRef = useRef(surfaceData)
  useEffect(() => { surfaceDataRef.current = surfaceData }, [surfaceData])
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

  useEffect(() => {
    setSurfaceData(normalizeSurfaceData(battlemap?.surface_data))
  }, [battlemap?.id, battlemap?.surface_data])

  useEffect(() => {
    surfaceUndoStackRef.current = []
    surfaceRedoStackRef.current = []
    setSurfaceUndoDepth(0)
    setSurfaceRedoDepth(0)
  }, [battlemap?.id])

  useEffect(() => {
    onSurfaceUndoStateChange?.(surfaceUndoDepth > 0)
  }, [onSurfaceUndoStateChange, surfaceUndoDepth])

  useEffect(() => {
    onSurfaceRedoStateChange?.(surfaceRedoDepth > 0)
  }, [onSurfaceRedoStateChange, surfaceRedoDepth])

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

  const saveSurfaceFireAndForget = useCallback((currentSurfaceData) => {
    const bm = battlemapRef.current
    if (!isSurfaceDirty.current || !bm?.id) return
    const battlemapId = bm.id
    const revision = surfaceSaveRevisionRef.current + 1
    surfaceSaveRevisionRef.current = revision

    surfaceSaveQueueRef.current = surfaceSaveQueueRef.current
      .catch(() => {})
      .then(() => fetch(`${import.meta.env.VITE_API_URL}/api/battlemaps/${battlemapId}/surface`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ surface_data: currentSurfaceData }),
      }))
      .then(() => {
        if (revision !== surfaceSaveRevisionRef.current) return
        isSurfaceDirty.current = false
        setBattlemap({ ...battlemapRef.current, surface_data: currentSurfaceData })
      })
      .catch(err => console.error('[Editor3D] Sauvegarde surfaces échouée :', err))
  }, [setBattlemap])

  // ─── Auto-save toutes les 60s si dirty ──────────────────────────────────
  useEffect(() => {
    saveTimer.current = setInterval(() => {
      saveFireAndForget(voxelsRef.current)
      saveSurfaceFireAndForget(surfaceDataRef.current)
    }, 60000)
    return () => clearInterval(saveTimer.current)
  }, [saveFireAndForget, saveSurfaceFireAndForget])

  // ─── Save au démontage (toggle retour mode jeu) ──────────────────────────
  // Utilise saveFireAndForget — le cleanup useEffect ne peut pas await une Promise.
  // battlemap.id en dépendance (pas saveFireAndForget) pour éviter une re-exécution
  // au changement de battlemap qui démonterait/remonterait inutilement.
  useEffect(() => {
    return () => {
      saveFireAndForget(voxelsRef.current)
      saveSurfaceFireAndForget(surfaceDataRef.current)
    }
  }, [saveFireAndForget, saveSurfaceFireAndForget])

  const handleSurfaceDataChange = useCallback((nextSurfaceData) => {
    if (nextSurfaceData === surfaceDataRef.current) return
    surfaceUndoStackRef.current = [
      ...surfaceUndoStackRef.current.slice(-49),
      cloneSurfaceData(surfaceDataRef.current),
    ]
    surfaceRedoStackRef.current = []
    setSurfaceUndoDepth(surfaceUndoStackRef.current.length)
    setSurfaceRedoDepth(0)
    setSurfaceData(nextSurfaceData)
    isSurfaceDirty.current = true
    saveSurfaceFireAndForget(nextSurfaceData)
  }, [saveSurfaceFireAndForget])

  const handleSurfaceUndo = useCallback(() => {
    const previousSurfaceData = surfaceUndoStackRef.current.pop()
    if (!previousSurfaceData) return false
    surfaceRedoStackRef.current = [
      ...surfaceRedoStackRef.current.slice(-49),
      cloneSurfaceData(surfaceDataRef.current),
    ]
    setSurfaceUndoDepth(surfaceUndoStackRef.current.length)
    setSurfaceRedoDepth(surfaceRedoStackRef.current.length)
    setSurfaceData(previousSurfaceData)
    isSurfaceDirty.current = true
    saveSurfaceFireAndForget(previousSurfaceData)
    return true
  }, [saveSurfaceFireAndForget])

  const handleSurfaceRedo = useCallback(() => {
    const nextSurfaceData = surfaceRedoStackRef.current.pop()
    if (!nextSurfaceData) return false
    surfaceUndoStackRef.current = [
      ...surfaceUndoStackRef.current.slice(-49),
      cloneSurfaceData(surfaceDataRef.current),
    ]
    setSurfaceUndoDepth(surfaceUndoStackRef.current.length)
    setSurfaceRedoDepth(surfaceRedoStackRef.current.length)
    setSurfaceData(nextSurfaceData)
    isSurfaceDirty.current = true
    saveSurfaceFireAndForget(nextSurfaceData)
    return true
  }, [saveSurfaceFireAndForget])

  useEffect(() => {
    if (surfaceUndoRequest === surfaceUndoRequestRef.current) return
    surfaceUndoRequestRef.current = surfaceUndoRequest
    handleSurfaceUndo()
  }, [surfaceUndoRequest, handleSurfaceUndo])

  useEffect(() => {
    if (surfaceRedoRequest === surfaceRedoRequestRef.current) return
    surfaceRedoRequestRef.current = surfaceRedoRequest
    handleSurfaceRedo()
  }, [surfaceRedoRequest, handleSurfaceRedo])

  useEffect(() => {
    const handleUndoKeyDown = (e) => {
      if (activeEditorTab === 'entity') return
      const target = e.target
      const isTextInput = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT'
        || target?.isContentEditable
      if (isTextInput) return

      const key = e.key.toLowerCase()
      const isModifier = e.ctrlKey || e.metaKey
      const isUndo = isModifier && !e.shiftKey && key === 'z'
      const isRedo = isModifier && (key === 'y' || (e.shiftKey && key === 'z'))
      if (!isUndo && !isRedo) return

      const didChange = isRedo ? handleSurfaceRedo() : handleSurfaceUndo()
      if (!didChange) return
      e.preventDefault()
    }

    document.addEventListener('keydown', handleUndoKeyDown)
    return () => document.removeEventListener('keydown', handleUndoKeyDown)
  }, [activeEditorTab, handleSurfaceRedo, handleSurfaceUndo])

  return (
    <Canvas
      camera={{ position: [15, 15, 15], fov: 60 }}
      style={{ background: '#0f172a' }}
      onCreated={({ gl }) => { gl.shadowMap.enabled = true }}
    >
      {blocksReady && activeEditorTab === 'entity' && (
        <EntityEditorScene
          voxels={voxels}
          surfaceData={surfaceData}
          textureMaterials={textureMaterials}
          entityTextureMaterials={entityTextureMaterials}
          socket={socket}
          battlemapId={battlemap?.id}
          activeBlueprint={activeBlueprint}
        />
      )}
      {blocksReady && activeEditorTab !== 'entity' && (
        <SurfaceEditorScene
          surfaceData={surfaceData}
          onSurfaceDataChange={handleSurfaceDataChange}
          textureMaterials={textureMaterials}
          activeMaterial={activeMaterial}
          surfaceTool={surfaceTool}
          availableBlocks={availableBlocks}
        />
      )}
    </Canvas>
  )
}
