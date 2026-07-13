import { useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { MapControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { WS } from '../../../shared/events.js'
import Voxel from './Voxel.jsx'
import EntityMesh from './EntityMesh.jsx'
import { useMapStore } from '../stores/mapStore'
import { useEntityStore } from '../stores/entityStore'

// ─── Constantes — identiques à Editor3D ──────────────────────────────────────
const GRID_SIZE = 50

// ─── EntityEditorScene ────────────────────────────────────────────────────────
// Scène éditeur entités. Gère : raycasting, double-clic pour poser,
// clic simple pour sélectionner, clic droit pour configurer, touche R pour rotation.
// Les voxels sont affichés à 60% d'opacité (contexte visuel, non-modifiables ici).
function EntityEditorScene({
  voxels, textureMaterials,
  entities, blueprints,
  selectedBlueprintId,
  socket, battlemapId,
}) {
  const { camera, gl, scene } = useThree()
  const orbitRef = useRef()
  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const mousePosRef = useRef({ x: 0, y: 0 })

  // ─── Position fantôme ──────────────────────────────────────────────────────
  const [ghostPos, setGhostPos] = useState(null)
  const [ghostR, setGhostR] = useState(0)

  // ─── Calcul position fantôme depuis la souris ──────────────────────────────
  const calcGroundPos = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const target = new THREE.Vector3()
    const hit = raycaster.ray.intersectPlane(groundPlane, target)
    if (!hit) return null
    const x = Math.round(target.x)
    const z = Math.round(target.z)
    if (Math.abs(x) > GRID_SIZE / 2 || Math.abs(z) > GRID_SIZE / 2) return null
    return { x, y: 0, z }
  }, [camera, gl])

  // ─── Détection entité sous le curseur ─────────────────────────────────────
  const getEntityUnderCursor = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const meshes = []
    scene.traverse(obj => {
      if (obj.userData.isEntity && obj.isMesh) meshes.push(obj)
    })
    const hits = raycaster.intersectObjects(meshes, false)
    if (hits.length === 0) return null
    return hits[0].object.userData.entityId
  }, [camera, gl, scene])

  // ─── Mouse move — mise à jour fantôme ─────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement
    const handleMouseMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY }
      if (!selectedBlueprintId) { setGhostPos(null); return }
      const pos = calcGroundPos(e.clientX, e.clientY)
      setGhostPos(pos)
    }
    canvas.addEventListener('mousemove', handleMouseMove)
    return () => canvas.removeEventListener('mousemove', handleMouseMove)
  }, [gl, selectedBlueprintId, calcGroundPos])

  // ─── Double-clic — poser une entité (PE5 — vérifier conflit MapControls) ──
  useEffect(() => {
    const canvas = gl.domElement
    const handleDblClick = async (e) => {
      if (!selectedBlueprintId || !battlemapId) return
      const pos = calcGroundPos(e.clientX, e.clientY)
      if (!pos) return

      // PE14 : threeToDb — pos.x = X, pos.y = 0 = altitude Y Three.js → pos_z,
      // pos.z = Z Three.js → pos_y
      try {
        const { default: api } = await import('../lib/api.js')
        const res = await api.post(`/battlemaps/${battlemapId}/entities`, {
          blueprint_id: selectedBlueprintId,
          pos_x: pos.x,
          pos_y: pos.z,   // profondeur Z Three.js → pos_y en base (PE14)
          pos_z: pos.y,   // altitude  Y Three.js → pos_z en base (PE14)
          r: ghostR,
        })
        const entity = res.data.entity
        // Broadcast à la room via WS
        if (socket && battlemapId) {
          socket.emit(WS.ENTITY_CREATED, { entityId: entity.id })
        }
      } catch (err) {
        console.error('[EntityEditor] Erreur pose entité :', err)
      }
    }
    canvas.addEventListener('dblclick', handleDblClick)
    return () => canvas.removeEventListener('dblclick', handleDblClick)
  }, [gl, selectedBlueprintId, battlemapId, ghostR, calcGroundPos, socket])

  // ─── Touche R — rotation fantôme ou entité existante ──────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        // Vérifier si une entité est sous le curseur
        const entityId = getEntityUnderCursor(mousePosRef.current.x, mousePosRef.current.y)
        if (entityId) {
          // Rotation d'une entité existante — PE13
          const entity = entities.find(en => en.id === entityId)
          if (!entity) return
          const newR = (entity.r + 1) % 4
          import('../lib/api.js').then(({ default: api }) => {
            api.put(`/entities/${entityId}`, { r: newR })
              .then(res => {
                if (socket && battlemapId) {
                  socket.emit(WS.ENTITY_MOVED, {
                    entityId,
                    pos_x: res.data.entity.pos_x,
                    pos_y: res.data.entity.pos_y,
                    pos_z: res.data.entity.pos_z,
                    r: newR,
                  })
                }
              })
              .catch(err => console.error('[EntityEditor] Erreur rotation entité :', err))
          })
        } else {
          // Rotation du fantôme (PE13)
          setGhostR(prev => (prev + 1) % 4)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [entities, getEntityUnderCursor, socket, battlemapId])

  // ─── Clic droit — prevent browser menu ────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement
    const prevent = (e) => e.preventDefault()
    canvas.addEventListener('contextmenu', prevent)
    return () => canvas.removeEventListener('contextmenu', prevent)
  }, [gl])

  // ─── MapControls config ───────────────────────────────────────────────────
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

  const getVoxelKey = (x, y, z) => `${x}:${y}:${z}`

  return (
    <>
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#ffffff', '#334155', 0.6]} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.6} />

      <MapControls
        ref={orbitRef}
        mouseButtons={{ LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }}
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

      {/* Voxels — contexte visuel (non modifiables en mode Entités) */}
      {Object.values(voxels).map(v => (
        <Voxel
          key={getVoxelKey(v.x, v.y, v.z)}
          position={[v.x, v.y, v.z]}
          textureMaterials={textureMaterials[v.tex]}
          geometry={v.geo}
          rotation={v.r}
        />
      ))}

      {/* Entités existantes */}
      {entities.map(entity => {
        const blueprint = blueprints[entity.blueprint_id]
        if (!blueprint) return null
        return (
          <EntityMesh
            key={entity.id}
            entity={entity}
            blueprint={blueprint}
            entityTextureMaterials={textureMaterials}
            altPressed={false}
            isGmOnly={entity.gm_only}
          />
        )
      })}

      {/* Fantôme entité — preview avant pose */}
      {ghostPos && selectedBlueprintId && blueprints[selectedBlueprintId] && (
        <GhostEntity
          position={ghostPos}
          blueprint={blueprints[selectedBlueprintId]}
          r={ghostR}
        />
      )}
    </>
  )
}

// ─── GhostEntity — preview semi-transparent avant pose ────────────────────────
// Analogue à GhostVoxel dans Editor3D.jsx — PE13.
function GhostEntity({ position, blueprint, r }) {
  if (!position || !blueprint) return null
  const { x, y, z } = position
  const rot = r * (Math.PI / 2)
  const width  = blueprint.geometry?.width  ?? 1
  const height = blueprint.geometry?.height ?? 1
  const depth  = blueprint.geometry?.depth  ?? 1

  return (
    <mesh
      position={[x + width / 2, y + height / 2, z + depth / 2]}
      rotation={[0, rot, 0]}
    >
      <boxGeometry args={[width, height, depth]} />
      <meshLambertMaterial color="#5b8dee" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  )
}

// ─── Composant principal exporté ──────────────────────────────────────────────
// EntityEditor — mode édition entités GM.
// Séparé d'Editor3D pour isoler complètement les deux modes d'édition (zéro régression voxels).
// Props :
//   socket      — pour émettre ENTITY_CREATED, ENTITY_MOVED
//   battlemapId — carte active
export default function EntityEditor({ socket, battlemapId }) {
  const { battlemap } = useMapStore()
  const { entities, blueprints } = useEntityStore()

  // Voxels pour le contexte visuel (60% opacité)
  const [voxels, setVoxels] = useState({})
  const [textureMaterials, setTextureMaterials] = useState({})
  const [ready, setReady] = useState(false)

  // Blueprint sélectionné dans la palette (future interface)
  // null = aucun blueprint actif, pas de pose possible
  const [selectedBlueprintId, setSelectedBlueprintId] = useState(null)

  // ─── Initialisation voxels depuis battlemap.voxel_data ──────────────────
  useEffect(() => {
    if (!battlemap?.voxel_data) { setVoxels({}); setReady(true); return }
    const map = {}
    for (const [key, val] of Object.entries(battlemap.voxel_data)) {
      const [x, y, z] = key.split(':').map(Number)
      map[key] = { x, y, z, tex: val.tex, geo: val.geo, r: val.r }
    }
    setVoxels(map)
  }, [battlemap?.id])

  // ─── Chargement textures voxels (contexte visuel) ────────────────────────
  useEffect(() => {
    const load = async () => {
      setReady(false)
      if (!battlemap?.voxel_data) { setReady(true); return }
      const texIds = [...new Set(Object.values(battlemap.voxel_data).map(v => v.tex))]
      if (texIds.length === 0) { setReady(true); return }
      try {
        const { default: api } = await import('../lib/api.js')
        const { loadVoxelTextures } = await import('../lib/voxelTextures.js')
        const { data } = await api.get(`/voxel-textures?ids=${texIds.join(',')}`)
        const loaded = await loadVoxelTextures(data.textures)
        setTextureMaterials(loaded)
      } catch (err) {
        console.error('[EntityEditor] Erreur chargement textures :', err)
      } finally {
        setReady(true)
      }
    }
    load()
  }, [battlemap?.id])

  return (
    <Canvas
      camera={{ position: [15, 15, 15], fov: 60 }}
      style={{ background: '#0f172a' }}
      onCreated={({ gl }) => { gl.shadowMap.enabled = true }}
    >
      {ready && (
        <EntityEditorScene
          voxels={voxels}
          textureMaterials={textureMaterials}
          entities={entities}
          blueprints={blueprints}
          selectedBlueprintId={selectedBlueprintId}
          socket={socket}
          battlemapId={battlemapId}
        />
      )}
    </Canvas>
  )
}
