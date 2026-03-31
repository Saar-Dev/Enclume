import { useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import api from '../lib/api.js'

// ─── Constantes ───────────────────────────────────────────────────────────────
const VOXEL_SIZE = 1
const GRID_SIZE = 50

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

    // 6 faces : right, left, top, bottom, front, back
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
    <mesh position={position} userData={{ isVoxel: true, position }}>
      <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
      {mats.map((mat, i) => <meshLambertMaterial key={i} attach={`material-${i}`} {...mat} />)}
    </mesh>
  )
}

// ─── Scène principale ─────────────────────────────────────────────────────────
function Scene({
  voxels, setVoxels, mode, activeMaterial,
  materials, onDirty, socket, battlemapId
}) {
  const { camera, gl, scene } = useThree()
  const orbitRef = useRef()
  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  const getVoxelKey = (x, y, z) => `${x},${y},${z}`

  const handleClick = useCallback((e) => {
    if (mode !== 'edit') return
    e.preventDefault()

    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )

    raycaster.setFromCamera(mouse, camera)

    // Clic droit — effacer
    if (e.button === 2) {
      const meshes = []
      scene.traverse(obj => { if (obj.userData.isVoxel) meshes.push(obj) })
      const hits = raycaster.intersectObjects(meshes)
      if (hits.length === 0) return

      const hit = hits[0].object
      const [x, y, z] = hit.userData.position
      const key = getVoxelKey(x, y, z)

      setVoxels(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      onDirty()
      socket?.emit('voxel:remove', { battlemapId, x, y, z })
      return
    }

    // Clic gauche — poser
    if (e.button !== 0) return

    const meshes = []
    scene.traverse(obj => { if (obj.userData.isVoxel) meshes.push(obj) })
    const hits = raycaster.intersectObjects(meshes)

    let x, y, z

    if (hits.length > 0) {
      // Poser sur la face d'un voxel existant
      const hit = hits[0]
      const normal = hit.face.normal.clone().round()
      const [vx, vy, vz] = hit.object.userData.position
      x = vx + normal.x
      y = vy + normal.y
      z = vz + normal.z
    } else {
      // Poser sur le plan de sol
      const target = new THREE.Vector3()
      raycaster.ray.intersectPlane(groundPlane, target)
      if (!target) return
      x = Math.round(target.x)
      y = 0
      z = Math.round(target.z)
    }

    // Vérifications limites
    if (Math.abs(x) > GRID_SIZE / 2 || Math.abs(z) > GRID_SIZE / 2 || y < 0 || y > 7) return

    const key = getVoxelKey(x, y, z)
    const voxel = { x, y, z, mat: activeMaterial }

    setVoxels(prev => ({ ...prev, [key]: voxel }))
    onDirty()
    socket?.emit('voxel:add', { battlemapId, ...voxel })
  }, [mode, activeMaterial, camera, gl, scene, socket, battlemapId])

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('mousedown', handleClick)
    return () => canvas.removeEventListener('mousedown', handleClick)
  }, [handleClick])

  // Désactiver clic droit navigateur sur le canvas en mode édition
  useEffect(() => {
    const canvas = gl.domElement
    const prevent = (e) => { if (mode === 'edit') e.preventDefault() }
    canvas.addEventListener('contextmenu', prevent)
    return () => canvas.removeEventListener('contextmenu', prevent)
  }, [mode, gl])

  // OrbitControls — désactiver clic droit en mode édition
  useEffect(() => {
    if (!orbitRef.current) return
    orbitRef.current.mouseButtons = mode === 'edit'
      ? { LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }
      : { LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }
  }, [mode])

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
      <directionalLight position={[-10, 5, -10]} intensity={0.3} />

      <OrbitControls
        ref={orbitRef}
        mouseButtons={{ LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }}
        enableDamping
        dampingFactor={0.05}
      />

      <Grid
        args={[GRID_SIZE, GRID_SIZE]}
        position={[0, -0.01, 0]}
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
    </>
  )
}

// ─── Composant principal exporté ──────────────────────────────────────────────
export default function Canvas3D({
  battlemap, mode, activeMaterial, onVoxelDataChange, onPackLoaded, socket
}) {
  const [voxels, setVoxels] = useState({})
  const [materials, setMaterials] = useState({})
  const [packsLoaded, setPacksLoaded] = useState(false)
  const isDirty = useRef(false)
  const saveTimer = useRef(null)

  // Charger les voxels depuis la battlemap
  useEffect(() => {
    if (!battlemap?.voxel_data) return
    const map = {}
    for (const v of battlemap.voxel_data) {
      map[`${v.x},${v.y},${v.z}`] = v
    }
    setVoxels(map)
  }, [battlemap?.id])

// Charger les textures
  useEffect(() => {
    api.get('/textures').then(async ({ data }) => {
      //console.log('Packs reçus:', JSON.stringify(data))
      if (!data.packs?.length) return
      const pack = data.packs[0]
      const loaded = await loadPackTextures(pack)
      setMaterials(loaded)
      setPacksLoaded(true)
      onPackLoaded?.(pack.materials)
    }).catch(console.error)
  }, [])

  // Marquer comme modifié
  const handleDirty = useCallback(() => {
    isDirty.current = true
  }, [])

  // Sauvegarde
  const save = useCallback(async (currentVoxels) => {
    if (!isDirty.current || !battlemap?.id) return
    const voxelArray = Object.values(currentVoxels)
    try {
await api.put(`/battlemaps/${battlemap.id}/voxels`, { voxel_data: voxelArray })
      isDirty.current = false
      onVoxelDataChange?.(voxelArray)
    } catch (err) {
      console.error('Erreur sauvegarde voxels :', err)
    }
  }, [battlemap?.id])

  // Sauvegarde automatique toutes les 60s
  useEffect(() => {
    saveTimer.current = setInterval(() => {
      if (isDirty.current) save(voxels)
    }, 60000)
    return () => clearInterval(saveTimer.current)
  }, [save, voxels])

  // Sauvegarde à la fermeture de l'éditeur (mode edit → play)
  const prevMode = useRef(mode)
  useEffect(() => {
    if (prevMode.current === 'edit' && mode === 'play') {
      save(voxels)
    }
    prevMode.current = mode
  }, [mode, save, voxels])

  return (
    <Canvas
      camera={{ position: [15, 15, 15], fov: 60 }}
      style={{ background: '#0f172a' }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true
      }}
    >
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
        />
      )}
    </Canvas>
  )
}