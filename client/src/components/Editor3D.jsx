import { Suspense, useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Edges, MapControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import raycastVoxels from 'fast-voxel-raycast'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import { loadVoxelTextures } from '../lib/voxelTextures.js'
import { persistSurfaceDocument } from '../lib/surfacePersistence.js'
import Voxel from './Voxel.jsx'
import EntityMesh from './EntityMesh.jsx'
import SurfaceConnectorPanel from './SurfaceConnectorPanel.jsx'
import SurfaceRoomPanel from './SurfaceRoomPanel.jsx'
import SurfaceWallPanel from './SurfaceWallPanel.jsx'
import SurfaceEditorScene from './SurfaceEditorScene.jsx'
import SurfaceDungeonScene, { cutWallsForDoorConnectors } from './SurfaceDungeonScene.jsx'
import CulledVoxelScene from './CulledVoxelScene.jsx'
import {
  applyRoomBoundaryArc,
  applyRoomWallAppearance,
  applyRoomWallElevationProfile,
  applyRoomToolUpdate,
  deleteRoomBoundaryWalls,
  deleteSurfaceRoom,
  entityUsesWallPlacement,
  expandRoomsToSurface,
  getFloorTopY,
  getWallRenderBox,
  hasSurfaceContent,
  isWorldInteriorPointVisibleAtLevel,
  isWorldPointVisibleAtLevel,
  levelToY,
  normalizeSurfaceData,
  parseFloorKey,
  removeRoomBoundaryArcs,
  roomsWallSegments,
  SURFACE_DATA_VERSION,
  SURFACE_FINE,
  yToLevel,
} from '../lib/surfaceData.js'
import { useMapStore } from '../stores/mapStore'
import { useEntityStore } from '../stores/entityStore'
// ─── Constantes — identiques à Canvas3D ──────────────────────────────────────
const GRID_SIZE = 50
const ROOM_DEFAULTS = {
  enabled: false,
  wallHeight: 2,
  floorTexId: null,
  wallTexId: null,
}

// ─── Utilitaire clé voxel ────────────────────────────────────────────────────
const getVoxelKey = (x, y, z) => `${x}:${y}:${z}`
const cloneSurfaceData = (data) => JSON.parse(JSON.stringify(data))
const blueprintPlacementMode = (blueprint) => (
  blueprint?.geometry?.placementMode || blueprint?.geometry?.placement_mode || 'free'
)
const clampInt = (value, min, max, fallback) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}
const normalizeRoomSelection = (selection) => {
  if (!selection?.start || !selection?.end) return null
  const minX = Math.min(selection.start.x, selection.end.x)
  const maxX = Math.max(selection.start.x, selection.end.x)
  const minZ = Math.min(selection.start.z, selection.end.z)
  const maxZ = Math.max(selection.start.z, selection.end.z)
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    y: selection.start.y,
    width: maxX - minX + 1,
    depth: maxZ - minZ + 1,
  }
}
const buildRoomVoxels = (selection, roomTool, activeMaterial) => {
  const area = normalizeRoomSelection(selection)
  if (!area) return []

  const tool = { ...ROOM_DEFAULTS, ...roomTool }
  const wallHeight = clampInt(tool.wallHeight, 1, 6, ROOM_DEFAULTS.wallHeight)
  const floorTex = tool.floorTexId || activeMaterial?.texId
  const wallTex = tool.wallTexId || activeMaterial?.texId
  if (!floorTex || !wallTex) return []

  const voxels = new Map()
  const put = (x, y, z, tex) => {
    if (Math.abs(x) > GRID_SIZE / 2 || Math.abs(z) > GRID_SIZE / 2 || y < 0 || y > 7) return
    voxels.set(getVoxelKey(x, y, z), { x, y, z, tex, geo: 'cube', r: 0 })
  }

  for (let x = area.minX; x <= area.maxX; x += 1) {
    for (let z = area.minZ; z <= area.maxZ; z += 1) {
      put(x, area.y, z, floorTex)
    }
  }

  for (let y = area.y + 1; y <= area.y + wallHeight; y += 1) {
    for (let x = area.minX - 1; x <= area.maxX + 1; x += 1) {
      put(x, y, area.minZ - 1, wallTex)
      put(x, y, area.maxZ + 1, wallTex)
    }
    for (let z = area.minZ; z <= area.maxZ; z += 1) {
      put(area.minX - 1, y, z, wallTex)
      put(area.maxX + 1, y, z, wallTex)
    }
  }

  return [...voxels.values()]
}

function RoomSelectionGhost({ selection, roomTool }) {
  const area = normalizeRoomSelection(selection)
  if (!area) return null

  const wallHeight = clampInt(roomTool?.wallHeight, 1, 6, ROOM_DEFAULTS.wallHeight)
  const wallY = area.y + 1 + wallHeight / 2
  return (
    <group>
      <mesh position={[area.minX + area.width / 2, area.y + 0.04, area.minZ + area.depth / 2]}>
        <boxGeometry args={[area.width, 0.08, area.depth]} />
        <meshLambertMaterial color="#5b8dee" transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <mesh position={[area.minX + area.width / 2, wallY, area.minZ - 0.5]}>
        <boxGeometry args={[area.width + 2, wallHeight, 1]} />
        <meshLambertMaterial color="#5b8dee" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh position={[area.minX + area.width / 2, wallY, area.maxZ + 1.5]}>
        <boxGeometry args={[area.width + 2, wallHeight, 1]} />
        <meshLambertMaterial color="#5b8dee" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh position={[area.minX - 0.5, wallY, area.minZ + area.depth / 2]}>
        <boxGeometry args={[1, wallHeight, area.depth]} />
        <meshLambertMaterial color="#5b8dee" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh position={[area.maxX + 1.5, wallY, area.minZ + area.depth / 2]}>
        <boxGeometry args={[1, wallHeight, area.depth]} />
        <meshLambertMaterial color="#5b8dee" transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  )
}

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
function GhostEntityBounds({ position, blueprint, r }) {
  if (!position || !blueprint) return null
  const { x, y, z } = position
  const rot = r * (Math.PI / 2)
  const width = blueprint.geometry?.width ?? 1
  const height = blueprint.geometry?.height ?? 1
  const depth = blueprint.geometry?.depth ?? 1
  const authoredOrigin = blueprint.geometry?.origin === 'floor-center' || blueprint.geometry?.origin === 'wall-back-center'
  return (
    <group position={[authoredOrigin ? x : x + width / 2, y, authoredOrigin ? z : z + depth / 2]} rotation={[0, rot, 0]}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color="#5b8dee" transparent opacity={0.18} depthWrite={false} />
        <Edges color="#7fb0ff" transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

function GhostEntity({ position, blueprint, r }) {
  if (!position || !blueprint) return null
  const entity = {
    id: `preview:${blueprint.id}`,
    blueprint_id: blueprint.id,
    pos_x: position.x,
    pos_y: position.z,
    pos_z: position.y,
    r,
    state: {},
    current_state_id: 0,
  }
  return (
    <Suspense fallback={<GhostEntityBounds position={position} blueprint={blueprint} r={r} />}>
      <EntityMesh
        entity={entity}
        blueprint={blueprint}
        entityTextureMaterials={null}
        sceneOpacity={1}
        isPreview
        isSelected
      />
    </Suspense>
  )
}

// ─── Scène éditeur entités ────────────────────────────────────────────────────
function EntityEditorScene({
  voxels,
  surfaceData,
  textureMaterials,
  entityTextureMaterials,
  socket,
  battlemapId,
  activeBlueprint,
  displayLevel = 0,
  selectedEntityId = null,
  onEntitySelect,
  selectedSurfaceConnectorId = null,
  onSurfaceConnectorSelect,
  onBlueprintPlaced,
}) {
  const { camera, gl, scene } = useThree()
  const orbitRef = useRef()
  const previousDisplayLevelRef = useRef(displayLevel)
  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const mousePosRef = useRef({ x: 0, y: 0 })
  const entityDragRef = useRef(null)
  const moveGhostRef = useRef(null)
  const { entities, blueprints, addEntity, removeEntity, updateEntity } = useEntityStore()
  const [ghostPos, setGhostPos] = useState(null)
  const [ghostR, setGhostR] = useState(0)
  const [moveGhost, setMoveGhost] = useState(null)
  const [cameraVolumeRoomId, setCameraVolumeRoomId] = useState(null)
  const handleSurfaceConnectorPointer = useCallback((connectorId, connector, event) => {
    const nativeEvent = event?.nativeEvent || event?.sourceEvent || event || {}
    const clientX = Number.isFinite(Number(nativeEvent.clientX)) ? Number(nativeEvent.clientX) : 24
    const clientY = Number.isFinite(Number(nativeEvent.clientY)) ? Number(nativeEvent.clientY) : 24
    onSurfaceConnectorSelect?.(connectorId, clientX, clientY)
  }, [onSurfaceConnectorSelect])

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

  const expandedSurface = useMemo(() => expandRoomsToSurface(surfaceData), [surfaceData])
  const displayedFloorSupports = useMemo(() => {
    const supports = new Map()
    for (const [id, floor] of Object.entries(expandedSurface.floors || {})) {
      const parsed = parseFloorKey(id, floor)
      if (yToLevel(parsed.y) !== displayLevel) continue
      const key = `${parsed.x}:${parsed.z}`
      const top = getFloorTopY(id, floor)
      supports.set(key, Math.max(supports.get(key) ?? -Infinity, top))
    }
    return supports
  }, [displayLevel, expandedSurface.floors])

  const displayedWallSupports = useMemo(() => {
    const surface = normalizeSurfaceData(surfaceData)
    const walls = cutWallsForDoorConnectors([
      ...roomsWallSegments(surface.rooms),
      ...Object.entries(surface.walls || {}).map(([id, wall]) => ({ ...wall, id: wall?.id || id })),
    ], surface.connectors)
    return walls.flatMap(wall => {
      if (!wall?.id || !wall?.axis || wall.axis === 'segment' || yToLevel(wall.y) !== displayLevel) return []
      const renderBox = getWallRenderBox(wall)
      if (!renderBox) return []
      const [width, height, depth] = renderBox.args
      const [x, y, z] = renderBox.position
      const min = new THREE.Vector3(x - width / 2, y - height / 2, z - depth / 2)
      const max = new THREE.Vector3(x + width / 2, y + height / 2, z + depth / 2)
      return [{
        wall,
        renderBox,
        box3: new THREE.Box3(min, max),
        minAlong: wall.axis === 'x' ? min.x : min.z,
        maxAlong: wall.axis === 'x' ? max.x : max.z,
        line: wall.axis === 'x' ? z : x,
        baseY: min.y,
        topY: max.y,
      }]
    })
  }, [displayLevel, surfaceData])

  const columnTops = useMemo(() => {
    const tops = {}
    for (const voxel of Object.values(voxels)) {
      const key = `${voxel.x}:${voxel.z}`
      const top = voxel.y + (voxel.geo === 'slab_bottom' ? 0.5 : 1)
      if (tops[key] === undefined || top > tops[key]) tops[key] = top
    }
    return tops
  }, [voxels])

  const calcEntityPos = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)

    // Traversée directe de la grille : coût proportionnel à la longueur du rayon,
    // jamais au nombre de triangles de la carte fusionnée.
    const hitPos = [0, 0, 0]
    const hitNorm = [0, 0, 0]
    const origin = raycaster.ray.origin
    const direction = raycaster.ray.direction
    const hit = raycastVoxels(
      (x, y, z) => !!voxels[`${x}:${y}:${z}`],
      [origin.x, origin.y, origin.z],
      [direction.x, direction.y, direction.z],
      100,
      hitPos,
      hitNorm
    )
    if (hit) {
      const x = Math.floor(hitPos[0] - hitNorm[0] * 0.01)
      const z = Math.floor(hitPos[2] - hitNorm[2] * 0.01)
      if (Math.abs(x) > GRID_SIZE / 2 || Math.abs(z) > GRID_SIZE / 2) return null
      return { x, y: columnTops[`${x}:${z}`] ?? 0, z }
    }

    // Fallback — intersection avec le sol Y=0
    const target = new THREE.Vector3()
    const hit2 = raycaster.ray.intersectPlane(groundPlane, target)
    if (!hit2) return null
    const x = Math.round(target.x)
    const z = Math.round(target.z)
    if (Math.abs(x) > GRID_SIZE / 2 || Math.abs(z) > GRID_SIZE / 2) return null
    return { x, y: 0, z }
  }, [camera, gl, voxels, columnTops])

  const calcPreciseEntityPos = useCallback((clientX, clientY, blueprint, rotation = 0) => {
    if (!blueprint) return null
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(mouse, camera)

    if (blueprintPlacementMode(blueprint) === 'wall') {
      let selected = null
      let selectedPoint = null
      let selectedDistance = Infinity
      for (const support of displayedWallSupports) {
        const point = raycaster.ray.intersectBox(support.box3, new THREE.Vector3())
        if (!point) continue
        const distance = point.distanceToSquared(raycaster.ray.origin)
        if (distance < selectedDistance) {
          selected = support
          selectedPoint = point
          selectedDistance = distance
        }
      }
      if (!selected || !selectedPoint) return null

      const sameLine = displayedWallSupports.filter(support => (
        support.wall.axis === selected.wall.axis
        && Math.abs(support.line - selected.line) < 0.001
        && Math.abs(support.baseY - selected.baseY) < 0.001
        && Math.abs(support.topY - selected.topY) < 0.001
      ))
      let connectedMin = selected.minAlong
      let connectedMax = selected.maxAlong
      let connected = [selected]
      let changed = true
      while (changed) {
        changed = false
        for (const support of sameLine) {
          if (connected.includes(support)) continue
          if (support.maxAlong < connectedMin - 0.001 || support.minAlong > connectedMax + 0.001) continue
          connected.push(support)
          connectedMin = Math.min(connectedMin, support.minAlong)
          connectedMax = Math.max(connectedMax, support.maxAlong)
          changed = true
        }
      }

      const width = Math.max(0.05, Number(blueprint.geometry?.width) || 1)
      const height = Math.max(0.05, Number(blueprint.geometry?.height) || 1)
      if (width > connectedMax - connectedMin + 0.001 || height > selected.topY - selected.baseY + 0.001) return null

      const positiveFace = selected.wall.axis === 'x'
        ? camera.position.z >= selected.line
        : camera.position.x >= selected.line
      const wallFace = positiveFace ? 'front' : 'back'
      const wallSide = selected.wall[`${wallFace}Role`] || wallFace
      const wallMount = blueprint.geometry?.wallMount || blueprint.geometry?.wall_mount || {}
      if (wallSide === 'interior' && wallMount.allowInterior === false) return null
      if (wallSide === 'exterior' && wallMount.allowExterior === false) return null

      const snap = value => Math.round(value * SURFACE_FINE) / SURFACE_FINE
      const halfWidth = width / 2
      const rawAlong = selected.wall.axis === 'x' ? selectedPoint.x : selectedPoint.z
      const along = Math.max(connectedMin + halfWidth, Math.min(connectedMax - halfWidth, snap(rawAlong)))
      const rawBottom = selectedPoint.y - height / 2
      const bottom = Math.max(selected.baseY, Math.min(selected.topY - height, snap(rawBottom)))
      const normal = selected.wall.axis === 'x'
        ? [0, 0, positiveFace ? 1 : -1]
        : [positiveFace ? 1 : -1, 0, 0]
      const surfaceCoordinate = selected.wall.axis === 'x'
        ? (positiveFace ? selected.box3.max.z : selected.box3.min.z)
        : (positiveFace ? selected.box3.max.x : selected.box3.min.x)
      const offset = 0.006
      const x = selected.wall.axis === 'x' ? along : surfaceCoordinate + normal[0] * offset
      const z = selected.wall.axis === 'x' ? surfaceCoordinate + normal[2] * offset : along
      const r = selected.wall.axis === 'x'
        ? (positiveFace ? 0 : 2)
        : (positiveFace ? 1 : 3)
      const precise = value => Math.round(value * 10000) / 10000
      return {
        x: precise(x),
        y: precise(bottom),
        z: precise(z),
        r,
        placement: {
          mode: 'wall',
          wallId: selected.wall.id,
          wallIds: connected.map(support => support.wall.id),
          wallAxis: selected.wall.axis,
          wallFace,
          wallSide,
          level: displayLevel,
          along: precise(along),
          bottomHeight: precise(bottom - selected.baseY),
          normal,
        },
      }
    }

    let centerX
    let centerZ
    let supportY = levelToY(displayLevel)

    if (hasSurfaceContent(surfaceData)) {
      const placementPlane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -(levelToY(displayLevel) + 0.125),
      )
      const target = new THREE.Vector3()
      const hit = raycaster.ray.intersectPlane(placementPlane, target)
      if (!hit) return null
      centerX = target.x
      centerZ = target.z
      supportY = displayedFloorSupports.get(`${Math.floor(centerX)}:${Math.floor(centerZ)}`) ?? supportY
    } else {
      const target = new THREE.Vector3()
      const placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -levelToY(displayLevel))
      const hit = raycaster.ray.intersectPlane(placementPlane, target)
      if (!hit) {
        const legacy = calcEntityPos(clientX, clientY)
        if (!legacy) return null
        centerX = legacy.x + 0.5
        centerZ = legacy.z + 0.5
        supportY = legacy.y
      } else {
        centerX = target.x
        centerZ = target.z
        const cellX = Math.floor(centerX)
        const cellZ = Math.floor(centerZ)
        supportY = columnTops[`${cellX}:${cellZ}`] ?? supportY
      }
    }

    const snappedCenterX = Math.round(centerX * SURFACE_FINE) / SURFACE_FINE
    const snappedCenterZ = Math.round(centerZ * SURFACE_FINE) / SURFACE_FINE
    if (Math.abs(snappedCenterX) > GRID_SIZE / 2 || Math.abs(snappedCenterZ) > GRID_SIZE / 2) return null

    const width = Number(blueprint.geometry?.width) || 1
    const depth = Number(blueprint.geometry?.depth) || 1
    const quarterTurn = Math.abs(Number(rotation) || 0) % 2 === 1
    const footprintWidth = quarterTurn ? depth : width
    const footprintDepth = quarterTurn ? width : depth
    const floorCentered = blueprint.geometry?.origin === 'floor-center'
    const precise = value => Math.round(value * 10000) / 10000
    return {
      x: precise(floorCentered ? snappedCenterX : snappedCenterX - footprintWidth / 2),
      y: precise(supportY),
      z: precise(floorCentered ? snappedCenterZ : snappedCenterZ - footprintDepth / 2),
      r: rotation,
      placement: { mode: 'free', level: displayLevel },
    }
  }, [calcEntityPos, camera, columnTops, displayLevel, displayedFloorSupports, displayedWallSupports, gl, surfaceData])

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
    for (const hit of hits) {
      const entityId = hit.object.userData.entityId
      const entity = entities.find(item => item.id === entityId)
      const blueprint = entity ? blueprints[entity.blueprint_id] : null
      const visibilityTest = entityUsesWallPlacement(entity, blueprint)
        ? isWorldPointVisibleAtLevel
        : isWorldInteriorPointVisibleAtLevel
      if (entity && visibilityTest(
        surfaceData,
        displayLevel,
        (Number(entity.pos_x) || 0) + 0.5,
        (Number(entity.pos_y) || 0) + 0.5,
        entity.pos_z,
        cameraVolumeRoomId,
      )) return entityId
    }
    return null
  }, [blueprints, camera, cameraVolumeRoomId, displayLevel, entities, gl, scene, surfaceData])

  useEffect(() => {
    const canvas = gl.domElement
    const onMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY }
      const drag = entityDragRef.current
      if (drag) {
        const distance = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY)
        if (distance >= 4) drag.moved = true
        if (drag.moved) {
          const entity = entities.find(item => item.id === drag.entityId)
          const blueprint = entity ? blueprints[entity.blueprint_id] : null
          const next = calcPreciseEntityPos(e.clientX, e.clientY, blueprint, entity?.r || 0)
          if (next && entity && blueprint) {
            const preview = { entityId: entity.id, position: next, blueprint, r: next.r ?? entity.r ?? 0 }
            moveGhostRef.current = preview
            setMoveGhost(preview)
          }
        }
        return
      }
      if (!activeBlueprint?.id) { setGhostPos(null); return }
      const next = calcPreciseEntityPos(e.clientX, e.clientY, activeBlueprint, ghostR)
      setGhostPos(prev => (
        prev?.x === next?.x
          && prev?.y === next?.y
          && prev?.z === next?.z
          && prev?.r === next?.r
          && prev?.placement?.wallId === next?.placement?.wallId
          && prev?.placement?.wallFace === next?.placement?.wallFace
          ? prev
          : next
      ))
    }
    canvas.addEventListener('mousemove', onMove)
    return () => canvas.removeEventListener('mousemove', onMove)
  }, [gl, activeBlueprint, blueprints, calcPreciseEntityPos, entities, ghostR])

  useEffect(() => {
    const canvas = gl.domElement
    const onMouseDown = async (e) => {
      if (e.button !== 0) return
      // Quand un blueprint est actif, le clic sert d'abord à le poser. Un
      // objet visible à un étage inférieur ne doit jamais voler ce clic.
      const entityId = activeBlueprint?.id ? null : getEntityUnderCursor(e.clientX, e.clientY)
      if (entityId) {
        const entity = entities.find(item => item.id === entityId)
        if (!entity) return
        onEntitySelect?.(entity, e.clientX, e.clientY)
        entityDragRef.current = {
          entityId,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        }
        setGhostPos(null)
        e.preventDefault()
        return
      }
      if (!activeBlueprint?.id || !battlemapId) {
        onEntitySelect?.(null, e.clientX, e.clientY)
        return
      }
      const pos = calcPreciseEntityPos(e.clientX, e.clientY, activeBlueprint, ghostR)
      if (!pos) return
      try {
        const res = await api.post(`/battlemaps/${battlemapId}/entities`, {
          blueprint_id: activeBlueprint.id,
          pos_x: pos.x, pos_y: pos.z, pos_z: pos.y, r: pos.r ?? ghostR, // PE14
          state: { placement: pos.placement || { mode: 'free', level: displayLevel } },
        })
        addEntity(res.data.entity)   // mise à jour store locale immédiate
        socket?.emit(WS.ENTITY_CREATED, { entityId: res.data.entity.id })
        setGhostPos(null)
        onBlueprintPlaced?.(res.data.entity)
      } catch (err) { console.error('[EntityEditor] Erreur pose entité :', err) }
    }
    canvas.addEventListener('mousedown', onMouseDown)
    return () => canvas.removeEventListener('mousedown', onMouseDown)
  }, [gl, activeBlueprint, battlemapId, displayLevel, ghostR, calcPreciseEntityPos, socket, entities, getEntityUnderCursor, onEntitySelect, onBlueprintPlaced, addEntity])

  useEffect(() => {
    const onMouseUp = async () => {
      const drag = entityDragRef.current
      const preview = moveGhostRef.current
      entityDragRef.current = null
      moveGhostRef.current = null
      setMoveGhost(null)
      if (!drag?.moved || !preview || preview.entityId !== drag.entityId) return
      try {
        const res = await api.put(`/entities/${drag.entityId}`, {
          pos_x: preview.position.x,
          pos_y: preview.position.z,
          pos_z: preview.position.y,
          r: preview.r,
          state: {
            ...(entities.find(entity => entity.id === drag.entityId)?.state || {}),
            placement: preview.position.placement,
          },
        })
        updateEntity(res.data.entity)
        socket?.emit(WS.ENTITY_MOVED, {
          entityId: drag.entityId,
          pos_x: res.data.entity.pos_x,
          pos_y: res.data.entity.pos_y,
          pos_z: res.data.entity.pos_z,
          r: res.data.entity.r,
          updated_at: res.data.entity.updated_at,
        })
      } catch (err) {
        console.error('[EntityEditor] Erreur deplacement :', err)
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [entities, socket, updateEntity])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'r' && e.key !== 'R') return
      const entityId = getEntityUnderCursor(mousePosRef.current.x, mousePosRef.current.y)
      if (entityId) {
        const entity = entities.find(en => en.id === entityId)
        if (!entity) return
        const blueprint = blueprints[entity.blueprint_id]
        if (blueprintPlacementMode(blueprint) === 'wall') return
        const newR = (entity.r + 1) % 4
        api.put(`/entities/${entityId}`, { r: newR })
          .then(res => {
            updateEntity(res.data.entity)
            socket?.emit(WS.ENTITY_MOVED, {
              entityId, pos_x: res.data.entity.pos_x,
              pos_y: res.data.entity.pos_y, pos_z: res.data.entity.pos_z, r: newR,
              updated_at: res.data.entity.updated_at,
            })
          })
          .catch(err => console.error('[EntityEditor] Erreur rotation :', err))
      } else {
        if (blueprintPlacementMode(activeBlueprint) === 'wall') return
        setGhostR(prev => (prev + 1) % 4)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeBlueprint, blueprints, entities, getEntityUnderCursor, socket, updateEntity])

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
        if (selectedEntityId === entityId) onEntitySelect?.(null)
        socket?.emit(WS.ENTITY_DELETED, { entityId })
      } catch (err) { console.error('[EntityEditor] Erreur suppression entité :', err) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [getEntityUnderCursor, onEntitySelect, removeEntity, selectedEntityId, socket])

  useEffect(() => {
    const canvas = gl.domElement
    const prevent = (e) => e.preventDefault()
    canvas.addEventListener('contextmenu', prevent)
    return () => canvas.removeEventListener('contextmenu', prevent)
  }, [gl])

  useEffect(() => {
    if (!orbitRef.current) return
    orbitRef.current.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }
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
        mouseButtons={{ LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }}
        enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI / 2}
      />
      <Grid args={[GRID_SIZE, GRID_SIZE]} position={[0, levelToY(displayLevel) + 0.01, 0]}
        cellColor="#334155" sectionColor="#475569" fadeDistance={80}
      />
      <Grid args={[GRID_SIZE, GRID_SIZE * SURFACE_FINE]} position={[0, levelToY(displayLevel) + 0.02, 0]}
        cellColor="#233044" sectionColor="#233044" fadeDistance={45}
      />
      {hasSurfaceContent(surfaceData) ? (
        <SurfaceDungeonScene
          surfaceData={surfaceData}
          textureMaterials={textureMaterials}
          showWater={false}
          ceilingOpacity={0.35}
          displayLevel={displayLevel}
          cameraControlsRef={orbitRef}
          onCameraRoomIdChange={setCameraVolumeRoomId}
          selectedConnectorId={selectedSurfaceConnectorId}
          onConnectorSelect={handleSurfaceConnectorPointer}
        />
      ) : (
        <CulledVoxelScene voxels={voxels} textureMaterials={textureMaterials} />
      )}
      {entities.map(entity => {
        const blueprint = blueprints[entity.blueprint_id]
        if (!blueprint) return null
        const visibilityTest = entityUsesWallPlacement(entity, blueprint)
          ? isWorldPointVisibleAtLevel
          : isWorldInteriorPointVisibleAtLevel
        if (!visibilityTest(
          surfaceData,
          displayLevel,
          (Number(entity.pos_x) || 0) + 0.5,
          (Number(entity.pos_y) || 0) + 0.5,
          entity.pos_z,
          cameraVolumeRoomId,
        )) return null
        const isMoving = moveGhost?.entityId === entity.id
        return (
          <EntityMesh key={entity.id} entity={entity} blueprint={blueprint}
            entityTextureMaterials={entityTextureMaterials} altPressed={false} isGmOnly={entity.gm_only}
            sceneOpacity={isMoving ? 0.22 : 1}
            isSelected={selectedEntityId === entity.id}
          />
        )
      })}
      {ghostPos && activeBlueprint && (
        <GhostEntity position={ghostPos} blueprint={activeBlueprint} r={ghostPos.r ?? ghostR} />
      )}
      {moveGhost && (
        <GhostEntity position={moveGhost.position} blueprint={moveGhost.blueprint} r={moveGhost.r} />
      )}
    </>
  )
}

// ─── Scène éditeur ────────────────────────────────────────────────────────────
// Lecture des voxels depuis les props — écriture via setVoxels + socket.emit.
function EditorScene({
  voxels, setVoxels, textureMaterials,
  activeMaterial, onActiveMaterialChange,
  roomTool,
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
  const [roomDrag, setRoomDrag] = useState(null)
  const roomDragRef = useRef(null)

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

  const calcRoomGridPos = useCallback((clientX, clientY) => {
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
      if (roomTool?.enabled) {
        const pos = calcRoomGridPos(e.clientX, e.clientY)
        setGhostPos(pos)
        if (pos && roomDragRef.current) {
          const nextDrag = { ...roomDragRef.current, end: pos }
          roomDragRef.current = nextDrag
          setRoomDrag(nextDrag)
        }
        return
      }
      if (!activeMaterial) { setGhostPos(null); return }
      const pos = calcGhostPos(e.clientX, e.clientY)
      setGhostPos(pos)
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    return () => canvas.removeEventListener('mousemove', handleMouseMove)
  }, [gl, activeMaterial, roomTool, calcGhostPos, calcRoomGridPos])

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
        if (roomTool?.enabled) {
          const pos = calcRoomGridPos(e.clientX, e.clientY)
          if (!pos) return
          const drag = { start: pos, end: pos }
          roomDragRef.current = drag
          setRoomDrag(drag)
          setGhostPos(pos)
          e.preventDefault()
          return
        }
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
  }, [gl, activeMaterial, roomTool, calcGhostPos, calcRoomGridPos, setVoxels, socket, battlemapId, isDirty])

  // ─── Mouse up droit — suppression si clic court (pas un drag caméra) ────
  // Si la souris a bougé de moins de 4px depuis le mousedown → clic court → suppression.
  // Si la souris a bougé davantage → drag caméra MapControls → ignorer.
  useEffect(() => {
    const canvas = gl.domElement
    const DRAG_THRESHOLD = 4

    const handleMouseUp = (e) => {
      if (e.button === 0 && roomTool?.enabled) {
        const drag = roomDragRef.current
        if (!drag) return
        const end = calcRoomGridPos(e.clientX, e.clientY) || drag.end
        const selection = { start: drag.start, end }
        roomDragRef.current = null
        setRoomDrag(null)

        const roomVoxels = buildRoomVoxels(selection, roomTool, activeMaterial)
        if (roomVoxels.length === 0) return
        setVoxels(prev => {
          const next = { ...prev }
          for (const voxel of roomVoxels) {
            next[getVoxelKey(voxel.x, voxel.y, voxel.z)] = voxel
          }
          return next
        })
        isDirty.current = true
        if (!battlemapId) return
        for (const voxel of roomVoxels) {
          socket?.emit(WS.VOXEL_ADD, { battlemapId, ...voxel })
        }
        return
      }

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
  }, [gl, roomTool, activeMaterial, calcRoomGridPos, getVoxelUnderCursor, voxels, setVoxels, socket, battlemapId, isDirty])

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
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    }
  }, [])

  const roomSelection = roomTool?.enabled
    ? roomDrag || (ghostPos ? { start: ghostPos, end: ghostPos } : null)
    : null

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

      {roomTool?.enabled ? (
        <RoomSelectionGhost selection={roomSelection} roomTool={roomTool} />
      ) : (
        <GhostVoxel
          position={ghostPos ? [ghostPos.x, ghostPos.y, ghostPos.z] : null}
          geometry={activeMaterial?.geo || 'cube'}
          rotation={activeMaterial?.r || 0}
        />
      )}
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
  surfaceTool,
  onSurfaceToolChange,
  surfaceUndoRequest = 0,
  surfaceRedoRequest = 0,
  onSurfaceUndoStateChange,
  onSurfaceRedoStateChange,
  displayLevel = 0,
  selectedEntityId = null,
  onEntitySelect,
  onBlueprintPlaced,
}) {
  const { battlemap, setBattlemap } = useMapStore()
  const { entities } = useEntityStore()
  const [entityTextureMaterials, setEntityTextureMaterials] = useState({})

  const [voxels, setVoxels] = useState({})
  const [surfaceData, setSurfaceData] = useState(() => normalizeSurfaceData(null))
  const [surfaceSaveError, setSurfaceSaveError] = useState(null)
  const [surfaceConnectorPanel, setSurfaceConnectorPanel] = useState(null)
  const [surfaceRoomPanel, setSurfaceRoomPanel] = useState(null)
  const [surfaceWallPanel, setSurfaceWallPanel] = useState(null)
  const [runtimeEffectRegions, setRuntimeEffectRegions] = useState([])
  const [runtimeElevatorStates, setRuntimeElevatorStates] = useState({})
  const [textureMaterials, setTextureMaterials] = useState({})
  const [blocksReady, setBlocksReady] = useState(false)

  const isDirty = useRef(false)
  const isSurfaceDirty = useRef(false)
  const saveTimer = useRef(null)
  const surfaceUndoStackRef = useRef([])
  const surfaceRedoStackRef = useRef([])
  const voxelSaveQueueRef = useRef(Promise.resolve())
  const voxelSaveRevisionRef = useRef(0)
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
  const surfaceQueuedBaseRef = useRef(normalizeSurfaceData(null))
  const processedRoomArcActionRef = useRef(null)
  const processedWallElevationProfileActionRef = useRef(null)
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
    const normalized = normalizeSurfaceData(battlemap?.surface_data)
    surfaceQueuedBaseRef.current = cloneSurfaceData(normalized)
    surfaceDataRef.current = normalized
    setSurfaceData(normalized)
    setSurfaceSaveError(null)
  }, [battlemap?.id, battlemap?.surface_data])

  const refreshRuntimeEffects = useCallback(async () => {
    if (!battlemap?.id) {
      setRuntimeEffectRegions([])
      return
    }
    try {
      const { data } = await api.get(`/battlemaps/${battlemap.id}/world-effects`)
      setRuntimeEffectRegions(data.worldEffects?.regions || [])
    } catch (error) {
      console.error('[Editor3D] Erreur chargement effets runtime :', error)
    }
  }, [battlemap?.id])

  useEffect(() => { refreshRuntimeEffects() }, [refreshRuntimeEffects])

  const refreshRuntimeElevators = useCallback(async () => {
    if (!battlemap?.id) {
      setRuntimeElevatorStates({})
      return
    }
    try {
      const { data } = await api.get(`/battlemaps/${battlemap.id}/world-elevators`)
      setRuntimeElevatorStates(data.worldElevators?.states || {})
    } catch (error) {
      console.error('[Editor3D] Erreur chargement ascenseurs runtime :', error)
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
    const battlemapId = bm.id
    const revision = voxelSaveRevisionRef.current + 1
    voxelSaveRevisionRef.current = revision
    const payload = {}
    for (const [key, v] of Object.entries(currentVoxels)) {
      payload[key] = { tex: v.tex, geo: v.geo, r: v.r }
    }

    voxelSaveQueueRef.current = voxelSaveQueueRef.current
      .catch(() => {})
      .then(() => {
        const currentBattlemap = battlemapRef.current
        return fetch(`${import.meta.env.VITE_API_URL}/api/battlemaps/${battlemapId}/voxels`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            voxel_data: payload,
            voxel_revision: currentBattlemap?.voxel_revision ?? 0,
          }),
        })
      })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || `Sauvegarde voxels HTTP ${response.status}`)
        return data
      })
      .then(data => {
        const isLatest = revision === voxelSaveRevisionRef.current
        const nextBattlemap = {
          ...battlemapRef.current,
          world_revision: Math.max(
            Number(battlemapRef.current?.world_revision || 0),
            Number(data.world_revision || 0),
          ),
          voxel_revision: data.voxel_revision,
          ...(isLatest ? { voxel_data: payload } : {}),
        }
        battlemapRef.current = nextBattlemap
        setBattlemap(nextBattlemap)
        if (isLatest) isDirty.current = false
      })
      .catch(err => console.error('[Editor3D] Sauvegarde échouée :', err))
  }, [setBattlemap])

  const saveSurfaceFireAndForget = useCallback((currentSurfaceData) => {
    const bm = battlemapRef.current
    if (!isSurfaceDirty.current || !bm?.id) return
    const battlemapId = bm.id
    const revision = surfaceSaveRevisionRef.current + 1
    surfaceSaveRevisionRef.current = revision

    const baseSurfaceData = cloneSurfaceData(surfaceQueuedBaseRef.current)
    surfaceQueuedBaseRef.current = cloneSurfaceData(currentSurfaceData)
    surfaceSaveQueueRef.current = surfaceSaveQueueRef.current
      .catch(() => {})
      .then(async () => {
        const currentBattlemap = battlemapRef.current
        return persistSurfaceDocument({
          apiBaseUrl: import.meta.env.VITE_API_URL,
          battlemapId,
          surfaceData: currentSurfaceData,
          expectedRevision: currentBattlemap?.surface_revision,
          baseSurfaceData,
        })
      })
      .then(({ data, remoteBattlemap }) => {
        if (remoteBattlemap) {
          battlemapRef.current = {
            ...battlemapRef.current,
            world_revision: remoteBattlemap.world_revision,
            surface_revision: remoteBattlemap.surface_revision,
          }
        }
        const isLatest = revision === surfaceSaveRevisionRef.current
        if (isLatest) surfaceQueuedBaseRef.current = cloneSurfaceData(data.surface_data)
        const nextBattlemap = {
          ...battlemapRef.current,
          world_revision: Math.max(
            Number(battlemapRef.current?.world_revision || 0),
            Number(data.world_revision || 0),
          ),
          surface_revision: data.surface_revision,
          ...(isLatest ? { surface_data: data.surface_data } : {}),
        }
        battlemapRef.current = nextBattlemap
        setBattlemap(nextBattlemap)
        setSurfaceSaveError(null)
        if (isLatest) isSurfaceDirty.current = false
      })
      .catch(err => {
        setSurfaceSaveError(err.message || 'La sauvegarde Surface a échoué.')
        console.error('[Editor3D] Sauvegarde surfaces échouée :', err)
      })
  }, [setBattlemap])

  // ─── save() async — pour les saves explicites futures (undo/redo) ────────
  // Payload format : { "x:y:z": { tex, geo, r } } — P_voxel_save_payload
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
    surfaceDataRef.current = nextSurfaceData
    setSurfaceData(nextSurfaceData)
    isSurfaceDirty.current = true
    saveSurfaceFireAndForget(nextSurfaceData)
  }, [saveSurfaceFireAndForget])

  const handleRuntimeEffectCreate = useCallback(async input => {
    if (!battlemap?.id) return
    try {
      await api.post(`/battlemaps/${battlemap.id}/world-effects/instances`, input)
      await refreshRuntimeEffects()
    } catch (error) {
      console.error('[Editor3D] Création effet runtime refusée :', error)
    }
  }, [battlemap?.id, refreshRuntimeEffects])

  const handleElevatorCommand = useCallback(async (elevatorId, command) => {
    if (!battlemap?.id || !elevatorId) return
    await api.post(`/battlemaps/${battlemap.id}/world-elevators/${elevatorId}/commands`, command)
    await refreshRuntimeElevators()
  }, [battlemap?.id, refreshRuntimeElevators])

  const selectedSurfaceConnector = useMemo(() => {
    const connectorId = surfaceConnectorPanel?.connectorId
    if (!connectorId) return null
    const connector = surfaceData.connectors?.[connectorId]
    return connector ? { id: connectorId, ...connector } : null
  }, [surfaceConnectorPanel?.connectorId, surfaceData.connectors])

  const selectedSurfaceRoom = useMemo(() => {
    const roomId = surfaceWallPanel?.roomId || surfaceRoomPanel?.roomId
    if (!roomId) return null
    const room = surfaceData.rooms?.[roomId]
    return room ? { id: roomId, ...room } : null
  }, [surfaceData.rooms, surfaceRoomPanel?.roomId, surfaceWallPanel?.roomId])

  const handleSurfaceConnectorSelect = useCallback((connectorId, clientX, clientY) => {
    if (!connectorId) return
    setSurfaceRoomPanel(null)
    setSurfaceWallPanel(null)
    setSurfaceConnectorPanel({ connectorId, x: clientX, y: clientY })
  }, [])

  const handleEntitySurfaceConnectorSelect = useCallback((connectorId, clientX, clientY) => {
    if (!connectorId) return
    onSurfaceToolChange?.({
      ...surfaceTool,
      mode: 'select',
      selectedRoomId: null,
      selectedRoomIds: [],
      selectedConnectorId: connectorId,
      roomWallEdit: false,
      selectedRoomWallKeys: [],
      selectedRoomWallCount: 0,
      roomArcError: null,
    })
    handleSurfaceConnectorSelect(connectorId, clientX, clientY)
  }, [handleSurfaceConnectorSelect, onSurfaceToolChange, surfaceTool])

  const handleSurfaceRoomSelect = useCallback((roomId, clientX, clientY) => {
    setSurfaceConnectorPanel(null)
    setSurfaceWallPanel(null)
    setSurfaceRoomPanel(roomId ? { roomId, x: clientX, y: clientY } : null)
  }, [])

  const handleSurfaceWallSelect = useCallback((roomId, clientX, clientY, count) => {
    setSurfaceConnectorPanel(null)
    setSurfaceRoomPanel(null)
    setSurfaceWallPanel(roomId && count > 0 ? { roomId, x: clientX, y: clientY } : null)
  }, [])

  const handleSurfaceSelectionToolPatch = useCallback(patch => {
    if (!patch) return
    onSurfaceToolChange?.({ ...surfaceTool, ...patch })
  }, [onSurfaceToolChange, surfaceTool])

  const handleSurfaceConnectorPatch = useCallback((connectorId, patch) => {
    if (!connectorId || !patch) return
    const currentSurfaceData = surfaceDataRef.current
    const connector = currentSurfaceData.connectors?.[connectorId]
    if (!connector) return

    handleSurfaceDataChange({
      ...currentSurfaceData,
      version: SURFACE_DATA_VERSION,
      connectors: {
        ...(currentSurfaceData.connectors || {}),
        [connectorId]: {
          ...connector,
          ...patch,
        },
      },
    })
  }, [handleSurfaceDataChange])

  const handleSurfaceConnectorDelete = useCallback(connectorId => {
    if (!connectorId) return
    const currentSurfaceData = surfaceDataRef.current
    if (!currentSurfaceData.connectors?.[connectorId]) return
    const connectors = { ...(currentSurfaceData.connectors || {}) }
    delete connectors[connectorId]
    handleSurfaceDataChange({ ...currentSurfaceData, version: SURFACE_DATA_VERSION, connectors })
    setSurfaceConnectorPanel(null)
    if (surfaceTool?.selectedConnectorId === connectorId) {
      onSurfaceToolChange?.({ ...surfaceTool, selectedConnectorId: null })
    }
  }, [handleSurfaceDataChange, onSurfaceToolChange, surfaceTool])

  const handleSurfaceRoomDelete = useCallback(roomId => {
    const nextSurfaceData = deleteSurfaceRoom(surfaceDataRef.current, roomId)
    if (nextSurfaceData === surfaceDataRef.current) return
    handleSurfaceDataChange(nextSurfaceData)
    setSurfaceConnectorPanel(null)
    setSurfaceRoomPanel(null)
    setSurfaceWallPanel(null)
    onSurfaceToolChange?.({
      ...surfaceTool,
      mode: 'select',
      selectedConnectorId: null,
      selectedRoomId: null,
      selectedRoomIds: [],
      roomWallEdit: false,
      selectedRoomWallKeys: [],
      selectedRoomWallCount: 0,
      roomArcError: null,
    })
  }, [handleSurfaceDataChange, onSurfaceToolChange, surfaceTool])

  const closeSurfaceConnectorPanel = useCallback(() => {
    setSurfaceConnectorPanel(null)
    if (!surfaceTool?.selectedConnectorId) return
    onSurfaceToolChange?.({
      ...surfaceTool,
      selectedConnectorId: null,
    })
  }, [onSurfaceToolChange, surfaceTool])

  const closeSurfaceRoomPanel = useCallback(() => {
    setSurfaceRoomPanel(null)
    if (!surfaceTool?.selectedRoomId) return
    onSurfaceToolChange?.({
      ...surfaceTool,
      selectedRoomId: null,
      selectedRoomIds: [],
      roomWallEdit: false,
      selectedRoomWallKeys: [],
      selectedRoomWallCount: 0,
      roomArcError: null,
    })
  }, [onSurfaceToolChange, surfaceTool])

  const closeSurfaceWallPanel = useCallback(() => {
    setSurfaceWallPanel(null)
    onSurfaceToolChange?.({
      ...surfaceTool,
      selectedRoomWallKeys: [],
      selectedRoomWallCount: 0,
      roomArcError: null,
    })
  }, [onSurfaceToolChange, surfaceTool])

  useEffect(() => {
    const connectorId = surfaceConnectorPanel?.connectorId
    if (!connectorId) return
    if (surfaceData.connectors?.[connectorId]) return
    setSurfaceConnectorPanel(null)
  }, [surfaceConnectorPanel?.connectorId, surfaceData.connectors])

  useEffect(() => {
    if (!surfaceConnectorPanel) return
    if (surfaceTool?.mode === 'select') return
    setSurfaceConnectorPanel(null)
  }, [surfaceConnectorPanel, surfaceTool?.mode])

  useEffect(() => {
    const placingOpeningOnSelectedWall = surfaceTool?.mode === 'connector'
      && ['door', 'window', 'screen-window'].includes(surfaceTool?.connectorType)
      && (surfaceTool?.connectorWallEdgeKeys || []).length > 0
    if (surfaceTool?.mode === 'select' || placingOpeningOnSelectedWall) return
    setSurfaceRoomPanel(null)
    setSurfaceWallPanel(null)
  }, [surfaceTool?.connectorType, surfaceTool?.connectorWallEdgeKeys, surfaceTool?.mode])

  useEffect(() => {
    const selectedRoomId = surfaceTool?.selectedRoomId
    if (surfaceRoomPanel && !surfaceData.rooms?.[surfaceRoomPanel.roomId]) {
      setSurfaceRoomPanel(selectedRoomId && surfaceData.rooms?.[selectedRoomId]
        ? { ...surfaceRoomPanel, roomId: selectedRoomId }
        : null)
    }
    if (surfaceWallPanel && !surfaceData.rooms?.[surfaceWallPanel.roomId]) {
      setSurfaceWallPanel(selectedRoomId && surfaceData.rooms?.[selectedRoomId]
        ? { ...surfaceWallPanel, roomId: selectedRoomId }
        : null)
    }
  }, [surfaceData.rooms, surfaceRoomPanel, surfaceTool?.selectedRoomId, surfaceWallPanel])

  useEffect(() => {
    const actionId = surfaceTool?.roomArcActionId
    if (!actionId || processedRoomArcActionRef.current === actionId) return
    processedRoomArcActionRef.current = actionId

    const roomId = surfaceTool?.selectedRoomId
    const edgeKeys = surfaceTool?.selectedRoomWallKeys || []
    const result = surfaceTool?.roomArcAction === 'remove'
      ? { surfaceData: removeRoomBoundaryArcs(surfaceDataRef.current, roomId, edgeKeys), error: null, roomId }
      : surfaceTool?.roomArcAction === 'delete'
        ? deleteRoomBoundaryWalls(surfaceDataRef.current, roomId, edgeKeys)
        : applyRoomBoundaryArc(
          surfaceDataRef.current,
          roomId,
          edgeKeys,
          surfaceTool?.roomArcAngle,
          surfaceTool?.roomArcSide,
        )

    if (result.error) {
      onSurfaceToolChange?.({
        ...surfaceTool,
        roomArcActionId: null,
        roomArcAction: null,
        roomArcError: result.error,
      })
      return
    }
    if (result.surfaceData !== surfaceDataRef.current) handleSurfaceDataChange(result.surfaceData)
    onSurfaceToolChange?.({
      ...surfaceTool,
      mode: 'select',
      selectedRoomId: result.roomId || roomId,
      selectedRoomIds: [result.roomId || roomId],
      roomWallEdit: true,
      selectedRoomWallKeys: [],
      selectedRoomWallCount: 0,
      roomArcActionId: null,
      roomArcAction: null,
      roomArcError: null,
    })
  }, [handleSurfaceDataChange, onSurfaceToolChange, surfaceTool])

  useEffect(() => {
    const actionId = surfaceTool?.wallElevationProfileActionId
    if (!actionId || processedWallElevationProfileActionRef.current === actionId) return
    processedWallElevationProfileActionRef.current = actionId
    const result = applyRoomWallElevationProfile(
      surfaceDataRef.current,
      surfaceTool?.selectedRoomId,
      surfaceTool?.selectedRoomWallKeys || [],
      surfaceTool?.wallElevationProfile,
    )
    if (result.surfaceData !== surfaceDataRef.current) handleSurfaceDataChange(result.surfaceData)
    onSurfaceToolChange?.({
      ...surfaceTool,
      wallElevationProfileActionId: null,
      roomArcError: result.error || null,
    })
  }, [handleSurfaceDataChange, onSurfaceToolChange, surfaceTool])

  const handleSurfaceWallAppearanceChange = useCallback(appearance => {
    const result = applyRoomWallAppearance(
      surfaceDataRef.current,
      surfaceTool?.selectedRoomId,
      surfaceTool?.selectedRoomWallKeys || [],
      appearance,
    )
    if (result.surfaceData !== surfaceDataRef.current) handleSurfaceDataChange(result.surfaceData)
    if (result.error) {
      onSurfaceToolChange?.({ ...surfaceTool, roomArcError: result.error })
    }
  }, [handleSurfaceDataChange, onSurfaceToolChange, surfaceTool])

  useEffect(() => {
    const roomId = surfaceTool?.selectedRoomId
    if (!roomId) return
    if (surfaceTool?.roomArcActionId) return
    if (['room', 'connector', 'stair', 'bridge', 'effect', 'erase'].includes(surfaceTool?.mode)) return
    const nextSurfaceData = applyRoomToolUpdate(
      surfaceDataRef.current,
      roomId,
      surfaceTool,
      activeMaterial,
      availableBlocks,
    )
    if (nextSurfaceData === surfaceDataRef.current) return
    handleSurfaceDataChange(nextSurfaceData)
  }, [surfaceTool, activeMaterial, availableBlocks, handleSurfaceDataChange])

  const handleSurfaceUndo = useCallback(() => {
    const previousSurfaceData = surfaceUndoStackRef.current.pop()
    if (!previousSurfaceData) return false
    surfaceRedoStackRef.current = [
      ...surfaceRedoStackRef.current.slice(-49),
      cloneSurfaceData(surfaceDataRef.current),
    ]
    setSurfaceUndoDepth(surfaceUndoStackRef.current.length)
    setSurfaceRedoDepth(surfaceRedoStackRef.current.length)
    surfaceDataRef.current = previousSurfaceData
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
    surfaceDataRef.current = nextSurfaceData
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

  const activeStructuralConnectorType = activeBlueprint?.geometry?.connectorType
  const placingStructuralObject = activeEditorTab === 'entity'
    && ['window', 'screen-window', 'skylight'].includes(activeStructuralConnectorType)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [15, 15, 15], fov: 60 }}
        style={{ width: '100%', height: '100%', background: '#0f172a' }}
        onCreated={({ gl }) => { gl.shadowMap.enabled = true }}
      >
        {blocksReady && activeEditorTab === 'entity' && !placingStructuralObject && (
          <EntityEditorScene
            key={activeBlueprint?.id || 'no-blueprint'}
            voxels={voxels}
            surfaceData={surfaceData}
            textureMaterials={textureMaterials}
            entityTextureMaterials={entityTextureMaterials}
            socket={socket}
            battlemapId={battlemap?.id}
            activeBlueprint={activeBlueprint}
            displayLevel={displayLevel}
            selectedEntityId={selectedEntityId}
            onEntitySelect={onEntitySelect}
            selectedSurfaceConnectorId={surfaceConnectorPanel?.connectorId || surfaceTool?.selectedConnectorId || null}
            onSurfaceConnectorSelect={handleEntitySurfaceConnectorSelect}
            onBlueprintPlaced={onBlueprintPlaced}
          />
        )}
        {blocksReady && (activeEditorTab !== 'entity' || placingStructuralObject) && (
          <SurfaceEditorScene
            surfaceData={surfaceData}
            onSurfaceDataChange={handleSurfaceDataChange}
            textureMaterials={textureMaterials}
            activeMaterial={activeMaterial}
            surfaceTool={surfaceTool}
            onSurfaceToolChange={onSurfaceToolChange}
            availableBlocks={availableBlocks}
            displayLevel={displayLevel}
            selectedConnectorId={surfaceConnectorPanel?.connectorId || surfaceTool?.selectedConnectorId || null}
            onSurfaceConnectorSelect={handleSurfaceConnectorSelect}
            onSurfaceRoomSelect={handleSurfaceRoomSelect}
            onSurfaceWallSelect={handleSurfaceWallSelect}
            runtimeEffectRegions={runtimeEffectRegions}
            runtimeFeatureStates={runtimeElevatorStates}
            onRuntimeEffectCreate={handleRuntimeEffectCreate}
            onConnectorPlaced={placingStructuralObject ? onBlueprintPlaced : null}
          />
        )}
      </Canvas>

      {surfaceSaveError && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 16,
            zIndex: 50,
            padding: '10px 14px',
            border: '1px solid #ef4444',
            borderRadius: 8,
            background: 'rgba(69, 10, 10, 0.96)',
            color: '#fee2e2',
            fontSize: 13,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
        >
          Sauvegarde du monde impossible : {surfaceSaveError}
        </div>
      )}

      {surfaceConnectorPanel && selectedSurfaceConnector && (
        <SurfaceConnectorPanel
          key={surfaceConnectorPanel.connectorId}
          connector={selectedSurfaceConnector}
          x={surfaceConnectorPanel.x}
          y={surfaceConnectorPanel.y}
          onPatch={handleSurfaceConnectorPatch}
          onDelete={handleSurfaceConnectorDelete}
          runtimeState={runtimeElevatorStates[selectedSurfaceConnector.worldId || selectedSurfaceConnector.id] || null}
          onElevatorCommand={handleElevatorCommand}
          onClose={closeSurfaceConnectorPanel}
        />
      )}
      {surfaceRoomPanel && selectedSurfaceRoom && (
        <SurfaceRoomPanel
          key={surfaceRoomPanel.roomId}
          room={selectedSurfaceRoom}
          tool={surfaceTool}
          x={surfaceRoomPanel.x}
          y={surfaceRoomPanel.y}
          onPatch={handleSurfaceSelectionToolPatch}
          onDelete={handleSurfaceRoomDelete}
          onClose={closeSurfaceRoomPanel}
        />
      )}
      {surfaceWallPanel && selectedSurfaceRoom && (
        <SurfaceWallPanel
          key={surfaceWallPanel.roomId}
          room={selectedSurfaceRoom}
          tool={surfaceTool}
          x={surfaceWallPanel.x}
          y={surfaceWallPanel.y}
          onPatch={handleSurfaceSelectionToolPatch}
          onAppearanceChange={handleSurfaceWallAppearanceChange}
          onClose={closeSurfaceWallPanel}
        />
      )}
    </div>
  )
}
