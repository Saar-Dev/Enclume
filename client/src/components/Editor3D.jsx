import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas, useThree } from '@react-three/fiber'
import { MapControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import raycastVoxels from 'fast-voxel-raycast'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import { loadVoxelTextures } from '../lib/voxelTextures.js'
import { useWorldRuntimeSync } from '../lib/useWorldRuntimeSync.js'
import { useSurfacePanels } from '../lib/useSurfacePanels.js'
import { useLegacyVoxelState } from '../legacyVoxel/useLegacyVoxelState.js'
import { useSurfaceDocument } from '../lib/useSurfaceDocument.js'
import EntityMesh from './EntityMesh.jsx'
import SurfaceConnectorPanel from './SurfaceConnectorPanel.jsx'
import SurfaceRoomPanel from './SurfaceRoomPanel.jsx'
import SurfaceWallPanel from './SurfaceWallPanel.jsx'
import SurfaceEditorScene from './SurfaceEditorScene.jsx'
import SurfaceDungeonScene, { cutWallsForDoorConnectors } from './SurfaceDungeonScene.jsx'
import CulledVoxelScene from './CulledVoxelScene.jsx'
import Skydome from './Skydome.jsx'
import GhostEntityBounds from './entityTools/GhostEntityBounds.jsx'
import TileSnapHighlight from './entityTools/TileSnapHighlight.jsx'
import GhostEntity from './entityTools/GhostEntity.jsx'
import {
  applyRoomBoundaryArc,
  applyRoomWallAppearance,
  applyRoomWallElevationProfile,
  applyRoomToolUpdate,
  computeSurfaceGridExtent,
  deleteRoomBoundaryWalls,
  expandRoomsToSurface,
  getFloorTopY,
  getWallRenderBox,
  hasSurfaceContent,
  isWorldPointVisibleAtLevel,
  levelToY,
  normalizeSurfaceData,
  parseFloorKey,
  removeRoomBoundaryArcs,
  roomsWallSegments,
  SURFACE_FINE,
  yToLevel,
} from '../lib/surfaceData.js'
import { useMapStore } from '../stores/mapStore'
import { useEntityStore } from '../stores/entityStore'
import { useSessionStore } from '../stores/sessionStore'
import { normalizeEntityScale } from '../../../shared/world/entityTransform.js'
// ─── Constantes — identiques à Canvas3D ──────────────────────────────────────
const GRID_SIZE = 50

const blueprintPlacementMode = (blueprint) => (
  blueprint?.geometry?.placementMode || blueprint?.geometry?.placement_mode || 'free'
)

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
  // Grille visuelle — grandit avec le sol construit, jamais au-delà de GRID_SIZE (garde-fou de
  // construction inchangé, cf. clamps `Math.abs(x) > GRID_SIZE / 2` plus bas dans ce fichier).
  const visibleGridSize = useMemo(
    () => computeSurfaceGridExtent(surfaceData, { max: GRID_SIZE }),
    [surfaceData],
  )
  const { entities, blueprints, addEntity, removeEntity, updateEntity } = useEntityStore()
  const { addMessage } = useSessionStore()
  const { t } = useTranslation()
  const [ghostPos, setGhostPos] = useState(null)
  const [ghostR, setGhostR] = useState(0)
  const [moveGhost, setMoveGhost] = useState(null)
  const [cameraVolumeRoomId, setCameraVolumeRoomId] = useState(null)
  // Snap sur la grande case (touche G) — défaut OFF, comportement de pose au sol inchangé tant
  // qu'on ne l'active pas explicitement. Portée volontairement limitée au sol (placement free) ;
  // les objets muraux gardent leur snap fin actuel (PLAN_ENTITES_INTERACTIVES_ROADMAP.md Lot A5).
  const [tileSnapEnabled, setTileSnapEnabled] = useState(false)

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

  // Empilement — sommet des entités posées (mode free uniquement) par case de grille, même logique
  // que columnTops/displayedFloorSupports : la hauteur de pose est celle de ce qu'il y a en dessous,
  // que ce soit le sol, un voxel ou une autre entité (patron pro confirmé — Unity/Unreal surface
  // snapping font un raycast vers le bas sans distinguer sol et objet). Liste par case (pas un max
  // déjà réduit) pour pouvoir exclure l'entité en cours de déplacement à la lecture, sans recalculer
  // toute la carte à chaque mousemove. pos_z est la BASE de l'entité (GhostEntityBounds positionne
  // le groupe à y puis décale le mesh de +height/2 à l'intérieur) — le sommet est donc pos_z+height,
  // échelle (state.transform.scale) comprise pour rester cohérent avec une entité agrandie.
  const entityTopSupportsByCell = useMemo(() => {
    const supports = new Map()
    for (const entity of entities) {
      const blueprint = blueprints[entity.blueprint_id]
      if (!blueprint) continue
      if (blueprintPlacementMode(blueprint) === 'wall') continue
      if (yToLevel(Number(entity.pos_z) || 0) !== displayLevel) continue

      const scale = normalizeEntityScale(entity.state)
      const width = (Number(blueprint.geometry?.width) || 1) * scale
      const depth = (Number(blueprint.geometry?.depth) || 1) * scale
      const height = (Number(blueprint.geometry?.height) || 1) * scale
      const quarterTurn = Math.abs(Number(entity.r) || 0) % 2 === 1
      const footprintWidth = quarterTurn ? depth : width
      const footprintDepth = quarterTurn ? width : depth
      const floorCentered = blueprint.geometry?.origin === 'floor-center'
      const x = Number(entity.pos_x) || 0
      const z = Number(entity.pos_y) || 0
      const minX = floorCentered ? x - footprintWidth / 2 : x
      const maxX = floorCentered ? x + footprintWidth / 2 : x + footprintWidth
      const minZ = floorCentered ? z - footprintDepth / 2 : z
      const maxZ = floorCentered ? z + footprintDepth / 2 : z + footprintDepth
      const top = (Number(entity.pos_z) || 0) + height

      // Cases FINES (SURFACE_FINE, même granularité que le placement lui-même — snap(value) =
      // Math.round(value*SURFACE_FINE)/SURFACE_FINE ailleurs dans ce fichier), pas la case entière
      // de columnTops/displayedFloorSupports. Une case entière faisait déclencher l'empilement
      // jusqu'à ~1 unité (4 pas de la grille fine affichée) du bord réel d'un objet — imprécision
      // confirmée en jeu (2026-09-16), pas seulement une limite en dessous du sol/voxel.
      const cxMax = Math.floor(maxX * SURFACE_FINE - 1e-6)
      const czMax = Math.floor(maxZ * SURFACE_FINE - 1e-6)
      for (let cx = Math.floor(minX * SURFACE_FINE); cx <= cxMax; cx++) {
        for (let cz = Math.floor(minZ * SURFACE_FINE); cz <= czMax; cz++) {
          const key = `${cx}:${cz}`
          const list = supports.get(key)
          if (list) list.push({ entityId: entity.id, top })
          else supports.set(key, [{ entityId: entity.id, top }])
        }
      }
    }
    return supports
  }, [entities, blueprints, displayLevel])

  // cellX/cellZ ici sont des cases FINES (déjà multipliées par SURFACE_FINE par l'appelant),
  // cohérentes avec la clé construite ci-dessus — jamais les cases entières de columnTops.
  const entityTopSupportAt = useCallback((fineCellX, fineCellZ, excludeEntityId) => {
    const list = entityTopSupportsByCell.get(`${fineCellX}:${fineCellZ}`)
    if (!list) return -Infinity
    let max = -Infinity
    for (const candidate of list) {
      if (candidate.entityId === excludeEntityId) continue
      if (candidate.top > max) max = candidate.top
    }
    return max
  }, [entityTopSupportsByCell])

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

  const calcPreciseEntityPos = useCallback((clientX, clientY, blueprint, rotation = 0, excludeEntityId = null) => {
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
      const cellX = Math.floor(centerX)
      const cellZ = Math.floor(centerZ)
      supportY = Math.max(
        displayedFloorSupports.get(`${cellX}:${cellZ}`) ?? supportY,
        entityTopSupportAt(Math.floor(centerX * SURFACE_FINE), Math.floor(centerZ * SURFACE_FINE), excludeEntityId),
      )
    } else {
      const target = new THREE.Vector3()
      const placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -levelToY(displayLevel))
      const hit = raycaster.ray.intersectPlane(placementPlane, target)
      if (!hit) {
        const legacy = calcEntityPos(clientX, clientY)
        if (!legacy) return null
        centerX = legacy.x + 0.5
        centerZ = legacy.z + 0.5
        supportY = Math.max(
          legacy.y,
          entityTopSupportAt(Math.floor(centerX * SURFACE_FINE), Math.floor(centerZ * SURFACE_FINE), excludeEntityId),
        )
      } else {
        centerX = target.x
        centerZ = target.z
        const cellX = Math.floor(centerX)
        const cellZ = Math.floor(centerZ)
        supportY = Math.max(
          columnTops[`${cellX}:${cellZ}`] ?? supportY,
          entityTopSupportAt(Math.floor(centerX * SURFACE_FINE), Math.floor(centerZ * SURFACE_FINE), excludeEntityId),
        )
      }
    }

    // Snap grille (case entière, centre à x.5) si tileSnapEnabled, sinon le snap fin d'origine.
    const snapValue = tileSnapEnabled
      ? value => Math.floor(value) + 0.5
      : value => Math.round(value * SURFACE_FINE) / SURFACE_FINE
    const snappedCenterX = snapValue(centerX)
    const snappedCenterZ = snapValue(centerZ)
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
  }, [calcEntityPos, camera, columnTops, displayLevel, displayedFloorSupports, displayedWallSupports, entityTopSupportAt, gl, surfaceData, tileSnapEnabled])

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
      if (entity && isWorldPointVisibleAtLevel(
        surfaceData,
        displayLevel,
        (Number(entity.pos_x) || 0) + 0.5,
        (Number(entity.pos_y) || 0) + 0.5,
        entity.pos_z,
        cameraVolumeRoomId,
      )) return entityId
    }
    return null
  }, [camera, cameraVolumeRoomId, displayLevel, entities, gl, scene, surfaceData])

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
          const next = calcPreciseEntityPos(e.clientX, e.clientY, blueprint, entity?.r || 0, entity?.id)
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
      } catch (err) {
        console.error('[EntityEditor] Erreur pose entité :', err)
        if (err?.response?.status === 409) {
          addMessage({
            id: `entity-position-occupied-${Date.now()}`,
            type: 'declare_error',
            text: t('session.entityPositionOccupied'),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          })
        }
      }
    }
    canvas.addEventListener('mousedown', onMouseDown)
    return () => canvas.removeEventListener('mousedown', onMouseDown)
  }, [gl, activeBlueprint, battlemapId, displayLevel, ghostR, calcPreciseEntityPos, socket, entities, getEntityUnderCursor, onEntitySelect, onBlueprintPlaced, addEntity, addMessage, t])

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
        if (err?.response?.status === 409) {
          addMessage({
            id: `entity-position-occupied-${Date.now()}`,
            type: 'declare_error',
            text: t('session.entityPositionOccupied'),
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          })
        }
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [entities, socket, updateEntity, addMessage, t])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'r' && e.key !== 'R') return

      // Une pose en cours (fantôme actif) a toujours priorité sur ce qu'il y a sous le curseur —
      // sinon R tourne une entité déjà posée qui se trouve par hasard sous la souris pendant qu'on
      // essaie d'orienter le fantôme (contre-intuitif, confirmé en jeu 2026-09-16, même principe
      // que la pose répétée : un mode actif prime sur l'ambiant). Ordre des deux branches inversé
      // par rapport à avant, comportement de chacune inchangé.
      if (activeBlueprint?.id) {
        if (blueprintPlacementMode(activeBlueprint) === 'wall') return
        setGhostR(prev => (prev + 1) % 4)
        return
      }

      const entityId = getEntityUnderCursor(mousePosRef.current.x, mousePosRef.current.y)
      if (!entityId) return
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
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeBlueprint, blueprints, entities, getEntityUnderCursor, socket, updateEntity])

  // ─── Snap grille — touche G (toggle) ────────────────────────────────────────
  // Mode global et persistant (pas lié à une pose en cours), comme un aimant qu'on active/désactive
  // — pas d'affordance visuelle ailleurs que le highlight de case (TileSnapHighlight), même
  // approche minimaliste que R/Delete dans ce fichier.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'g' && e.key !== 'G') return
      const target = e.target
      const isTextInput = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT'
        || target?.isContentEditable
      if (isTextInput) return
      setTileSnapEnabled(prev => !prev)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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
      <Grid args={[visibleGridSize, visibleGridSize]} position={[0, levelToY(displayLevel) + 0.01, 0]}
        cellColor="#334155" sectionColor="#475569" fadeDistance={80}
      />
      <Grid args={[visibleGridSize, visibleGridSize * SURFACE_FINE]} position={[0, levelToY(displayLevel) + 0.02, 0]}
        cellColor="#233044" sectionColor="#233044" fadeDistance={45}
      />
      {hasSurfaceContent(surfaceData) ? (
        <SurfaceDungeonScene
          surfaceData={surfaceData}
          textureMaterials={textureMaterials}
          ceilingOpacity={0.35}
          displayLevel={displayLevel}
          cameraControlsRef={orbitRef}
          onCameraRoomIdChange={setCameraVolumeRoomId}
          wallOcclusionEnabled={false}
        />
      ) : (
        <CulledVoxelScene voxels={voxels} textureMaterials={textureMaterials} />
      )}
      {entities.map(entity => {
        const blueprint = blueprints[entity.blueprint_id]
        if (!blueprint) return null
        if (!isWorldPointVisibleAtLevel(
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
        <>
          <GhostEntity position={ghostPos} blueprint={activeBlueprint} r={ghostPos.r ?? ghostR} />
          {tileSnapEnabled && <TileSnapHighlight position={ghostPos} />}
        </>
      )}
      {moveGhost && (
        <>
          <GhostEntity position={moveGhost.position} blueprint={moveGhost.blueprint} r={moveGhost.r} />
          {tileSnapEnabled && <TileSnapHighlight position={moveGhost.position} />}
        </>
      )}
    </>
  )
}

// ─── Composant principal exporté ──────────────────────────────────────────────
// Editor3D — mode édition GM.
// Gère : chargement blocs, voxels, save, raccourcis clavier sélection palette.
// Props :
//   socket                  — pour émettre les événements temps réel (entités, effets runtime…)
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
  sidebarWidth = 0,
}) {
  const { battlemap, setBattlemap } = useMapStore()
  const { entities } = useEntityStore()
  const [entityTextureMaterials, setEntityTextureMaterials] = useState({})

  const [textureMaterials, setTextureMaterials] = useState({})
  const [blocksReady, setBlocksReady] = useState(false)

  const saveTimer = useRef(null)
  const processedRoomArcActionRef = useRef(null)
  const processedWallElevationProfileActionRef = useRef(null)
  // battlemapRef — miroir de battlemap pour saveFireAndForget stable (pas de recréation du timer)
  const battlemapRef = useRef(battlemap)
  useEffect(() => { battlemapRef.current = battlemap }, [battlemap])

  const { voxels, voxelsRef, saveVoxelsFireAndForget } = useLegacyVoxelState(battlemap, battlemapRef, setBattlemap)

  const {
    surfaceData,
    surfaceDataRef,
    surfaceSaveError,
    handleSurfaceDataChange,
    saveSurfaceFireAndForget,
  } = useSurfaceDocument({
    battlemap,
    battlemapRef,
    setBattlemap,
    activeEditorTab,
    surfaceUndoRequest,
    surfaceRedoRequest,
    onSurfaceUndoStateChange,
    onSurfaceRedoStateChange,
  })

  const {
    worldEffects,
    runtimeElevatorStates,
    refreshWorldEffects: refreshRuntimeEffects,
  } = useWorldRuntimeSync(battlemap?.id, socket)

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

  // ─── save() async — pour les saves explicites futures (undo/redo) ────────
  // Payload format : { "x:y:z": { tex, geo, r } } — P_voxel_save_payload
  // ─── Auto-save toutes les 60s si dirty ──────────────────────────────────
  useEffect(() => {
    saveTimer.current = setInterval(() => {
      saveVoxelsFireAndForget(voxelsRef.current)
      saveSurfaceFireAndForget(surfaceDataRef.current)
    }, 60000)
    return () => clearInterval(saveTimer.current)
  }, [saveVoxelsFireAndForget, saveSurfaceFireAndForget, voxelsRef, surfaceDataRef])

  // ─── Save au démontage (toggle retour mode jeu) ──────────────────────────
  // Utilise saveVoxelsFireAndForget — le cleanup useEffect ne peut pas await une Promise.
  // battlemap.id en dépendance (pas saveVoxelsFireAndForget) pour éviter une re-exécution
  // au changement de battlemap qui démonterait/remonterait inutilement.
  useEffect(() => {
    return () => {
      saveVoxelsFireAndForget(voxelsRef.current)
      saveSurfaceFireAndForget(surfaceDataRef.current)
    }
  }, [saveVoxelsFireAndForget, saveSurfaceFireAndForget, voxelsRef, surfaceDataRef])

  const handleRuntimeEffectCreate = useCallback(async input => {
    if (!battlemap?.id) return
    try {
      await api.post(`/battlemaps/${battlemap.id}/world-effects/instances`, input)
      await refreshRuntimeEffects()
    } catch (error) {
      console.error('[Editor3D] Création effet runtime refusée :', error)
    }
  }, [battlemap?.id, refreshRuntimeEffects])

  const {
    surfaceConnectorPanel,
    surfaceRoomPanel,
    surfaceWallPanel,
    selectedSurfaceConnector,
    selectedSurfaceRoom,
    handleSurfaceConnectorSelect,
    handleSurfaceRoomSelect,
    handleSurfaceWallSelect,
    handleSurfaceSelectionToolPatch,
    handleSurfaceConnectorPatch,
    handleSurfaceConnectorDelete,
    handleSurfaceRoomDelete,
    closeSurfaceConnectorPanel,
    closeSurfaceRoomPanel,
    closeSurfaceWallPanel,
  } = useSurfacePanels({
    surfaceData,
    surfaceDataRef,
    surfaceTool,
    onSurfaceToolChange,
    onSurfaceDataChange: handleSurfaceDataChange,
  })

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
  }, [handleSurfaceDataChange, onSurfaceToolChange, surfaceTool, surfaceDataRef])

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
    if (result.surfaceData !== surfaceDataRef.current) {
      handleSurfaceDataChange(
        result.surfaceData,
        `wall-elevation:${surfaceTool?.selectedRoomId}:${(surfaceTool?.selectedRoomWallKeys || []).join(',')}`,
      )
    }
    onSurfaceToolChange?.({
      ...surfaceTool,
      wallElevationProfileActionId: null,
      roomArcError: result.error || null,
    })
  }, [handleSurfaceDataChange, onSurfaceToolChange, surfaceTool, surfaceDataRef])

  const handleSurfaceWallAppearanceChange = useCallback(appearance => {
    const result = applyRoomWallAppearance(
      surfaceDataRef.current,
      surfaceTool?.selectedRoomId,
      surfaceTool?.selectedRoomWallKeys || [],
      appearance,
    )
    if (result.surfaceData !== surfaceDataRef.current) {
      handleSurfaceDataChange(
        result.surfaceData,
        `wall-appearance:${surfaceTool?.selectedRoomId}:${(surfaceTool?.selectedRoomWallKeys || []).join(',')}`,
      )
    }
    if (result.error) {
      onSurfaceToolChange?.({ ...surfaceTool, roomArcError: result.error })
    }
  }, [handleSurfaceDataChange, onSurfaceToolChange, surfaceTool, surfaceDataRef])

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
  }, [surfaceTool, activeMaterial, availableBlocks, handleSurfaceDataChange, surfaceDataRef])

  // ─── Échap — sortir d'un outil de pose/dessin ────────────────────────────
  // Tous les outils de pose (Salle, Mur, Connecteurs, Peindre, Remodeler, Zone d'effet…) restent
  // désormais actifs après un geste réussi (§12.9, PLAN_WORLD_BUILDER_REWORK.md) au lieu de repasser
  // silencieusement en Sélection selon des règles différentes par outil — Échap est l'unique sortie
  // explicite, commune à tous.
  useEffect(() => {
    const handleEscapeKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (activeEditorTab !== 'world') return
      if (!surfaceTool?.mode || surfaceTool.mode === 'select') return
      onSurfaceToolChange?.({ ...surfaceTool, mode: 'select', roomArcError: null, connectorWallEdgeKeys: [] })
    }
    document.addEventListener('keydown', handleEscapeKeyDown)
    return () => document.removeEventListener('keydown', handleEscapeKeyDown)
  }, [activeEditorTab, onSurfaceToolChange, surfaceTool])

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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [15, 15, 15], fov: 60 }}
        style={{ width: '100%', height: '100%', background: '#0f172a' }}
        onCreated={({ gl }) => { gl.shadowMap.enabled = true }}
      >
        <Skydome preset="ocean_floor" />
        {blocksReady && activeEditorTab === 'entity' && (
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
            onBlueprintPlaced={onBlueprintPlaced}
          />
        )}
        {blocksReady && activeEditorTab !== 'entity' && (
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
            runtimeEffectRegions={worldEffects.regions}
            runtimeFeatureStates={runtimeElevatorStates}
            onRuntimeEffectCreate={handleRuntimeEffectCreate}
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
          canEdit
          onClose={closeSurfaceConnectorPanel}
          dockRight={sidebarWidth + 16}
        />
      )}
      {surfaceRoomPanel && selectedSurfaceRoom && (
        <SurfaceRoomPanel
          key={surfaceRoomPanel.roomId}
          room={selectedSurfaceRoom}
          tool={surfaceTool}
          onPatch={handleSurfaceSelectionToolPatch}
          onDelete={handleSurfaceRoomDelete}
          onClose={closeSurfaceRoomPanel}
          dockRight={sidebarWidth + 16}
        />
      )}
      {surfaceWallPanel && selectedSurfaceRoom && (
        <SurfaceWallPanel
          key={surfaceWallPanel.roomId}
          room={selectedSurfaceRoom}
          tool={surfaceTool}
          onPatch={handleSurfaceSelectionToolPatch}
          onAppearanceChange={handleSurfaceWallAppearanceChange}
          onClose={closeSurfaceWallPanel}
          dockRight={sidebarWidth + 16}
        />
      )}
    </div>
  )
}
