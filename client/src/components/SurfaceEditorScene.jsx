import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Grid, MapControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import SurfaceDungeonScene from './SurfaceDungeonScene.jsx'
import {
  SURFACE_FINE,
  STORY_HEIGHT,
  applyBridgeSelection,
  applyCeilingSelection,
  applyDoorConnector,
  applyElevatorConnector,
  applyFloorSelection,
  applyLadderConnector,
  applyRoomSelection,
  applyStairSelection,
  applyWallDrag,
  eraseSurfaceSelection,
  findRoomAtCell,
  findRoomsInSelection,
  getToolCeilingHeight,
  getToolCeilingThickness,
  getToolElevation,
  getToolFloorThickness,
  getRoomBaseY,
  getRoomBoundaryWallRuns,
  getRoomHeightLevels,
  getToolRoomHeightLevels,
  getToolWallThicknessFine,
  getWallRenderBox,
  isWorldPointVisibleAtLevel,
  levelToY,
  makeStairFromSelection,
  makeDoorConnectorFromWallPoint,
  makeElevatorConnectorFromCell,
  makeLadderConnectorFromCell,
  makeWallsFromDrag,
  normalizeSurfaceData,
  parseFloorKey,
  normalizeCellSelection,
  roomToSurfaceToolPatch,
  roomFootprintRectangles,
  roomWallSegments,
  roomsWallSegments,
  stairStepBoxes,
  yToLevel,
} from '../lib/surfaceData.js'
import {
  makeRoomBoundaryArc,
  roomBoundaryContours,
  sampleRoomBoundaryArc,
} from '../../../shared/world/roomGeometry.js'

const GRID_SIZE = 50
const WALL_STICKY_THRESHOLD = 0.18

function sameLevel(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.001
}

function getEditPlaneY(surfaceTool) {
  return getToolElevation(surfaceTool)
}

function inRangeWithMargin(value, min, max, margin) {
  return value >= min - margin && value <= max + margin
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function FloorPreview({ selection, surfaceTool }) {
  const area = normalizeCellSelection(selection)
  if (!area) return null

  const y = getToolElevation(surfaceTool)
  const isErase = selection?.mode === 'erase'
  const thickness = isErase ? 0.03 : getToolFloorThickness(surfaceTool)
  const editPlaneY = getEditPlaneY(surfaceTool)
  const color = isErase ? '#ff5c7a' : '#5b8dee'
  const opacity = isErase ? 0.28 : 0.35

  return (
    <mesh
      position={[area.minX + area.width / 2, isErase ? editPlaneY + 0.08 : y, area.minZ + area.depth / 2]}
    >
      <boxGeometry args={[area.width, thickness, area.depth]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

function RoomPreviewMaterial() {
  return <meshBasicMaterial color="#5b8dee" transparent opacity={0.2} depthWrite={false} />
}

function RoomPreview({ selection, surfaceTool }) {
  const area = normalizeCellSelection(selection)
  if (!area) return null

  const baseY = getToolElevation(surfaceTool)
  const height = getToolRoomHeightLevels(surfaceTool) * STORY_HEIGHT
  const centerX = area.minX + area.width / 2
  const centerZ = area.minZ + area.depth / 2
  const wallY = baseY + height / 2
  return (
    <group>
      <mesh position={[centerX, baseY, centerZ]}>
        <boxGeometry args={[area.width, 0.08, area.depth]} />
        <RoomPreviewMaterial />
      </mesh>
      <mesh position={[centerX, baseY + height, centerZ]}>
        <boxGeometry args={[area.width, 0.08, area.depth]} />
        <RoomPreviewMaterial />
      </mesh>
      <mesh position={[centerX, wallY, area.minZ]}>
        <boxGeometry args={[area.width, height, 0.08]} />
        <RoomPreviewMaterial />
      </mesh>
      <mesh position={[centerX, wallY, area.maxZ + 1]}>
        <boxGeometry args={[area.width, height, 0.08]} />
        <RoomPreviewMaterial />
      </mesh>
      <mesh position={[area.minX, wallY, centerZ]}>
        <boxGeometry args={[0.08, height, area.depth]} />
        <RoomPreviewMaterial />
      </mesh>
      <mesh position={[area.maxX + 1, wallY, centerZ]}>
        <boxGeometry args={[0.08, height, area.depth]} />
        <RoomPreviewMaterial />
      </mesh>
    </group>
  )
}

function SelectionPreview({ selection, surfaceTool }) {
  const area = normalizeCellSelection(selection)
  if (!area) return null

  return (
    <mesh position={[area.minX + area.width / 2, getToolElevation(surfaceTool) + 0.08, area.minZ + area.depth / 2]}>
      <boxGeometry args={[area.width, 0.04, area.depth]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.22} depthWrite={false} />
    </mesh>
  )
}

function SelectedRoomOverlay({ room, roomLookup }) {
  if (!room) return null
  const baseY = getRoomBaseY(room)
  const height = getRoomHeightLevels(room) * STORY_HEIGHT
  const rectangles = roomFootprintRectangles(room)
  const walls = roomWallSegments(room, roomLookup)
  const material = () => <meshBasicMaterial color="#fbbf24" transparent opacity={0.36} depthWrite={false} />

  return (
    <group renderOrder={30}>
      {(Array.isArray(room.boundaryArcs) && room.boundaryArcs.length > 0)
        || (Array.isArray(room.geometryClipRoomIds) && room.geometryClipRoomIds.length > 0) ? [
        <RoomSelectionShape key="curved-floor" room={room} roomLookup={roomLookup} y={baseY + 0.08} />,
        <RoomSelectionShape key="curved-ceiling" room={room} roomLookup={roomLookup} y={baseY + height + 0.08} />,
      ] : rectangles.flatMap(rectangle => [
        <mesh key={`floor:${rectangle.minX}:${rectangle.minZ}`} position={[rectangle.minX + rectangle.width / 2, baseY + 0.06, rectangle.minZ + rectangle.depth / 2]}>
          <boxGeometry args={[rectangle.width, 0.04, rectangle.depth]} />
          {material()}
        </mesh>,
        <mesh key={`ceiling:${rectangle.minX}:${rectangle.minZ}`} position={[rectangle.minX + rectangle.width / 2, baseY + height + 0.06, rectangle.minZ + rectangle.depth / 2]}>
          <boxGeometry args={[rectangle.width, 0.04, rectangle.depth]} />
          {material()}
        </mesh>,
      ])}
      {walls.map(wall => {
        const box = getWallRenderBox(wall)
        if (!box) return null
        return (
          <mesh key={wall.id} position={box.position} rotation={[0, box.rotationY || 0, 0]}>
            <boxGeometry args={box.args} />
            {material()}
          </mesh>
        )
      })}
    </group>
  )
}

function roomSelectionShapes(room, roomLookup) {
  const contours = roomBoundaryContours(room, roomLookup)
  const polygons = new Map()
  for (const contour of contours) {
    if (!polygons.has(contour.polygonIndex)) polygons.set(contour.polygonIndex, { outer: null, holes: [] })
    const polygon = polygons.get(contour.polygonIndex)
    if (contour.isHole) polygon.holes.push(contour)
    else polygon.outer = contour
  }
  return [...polygons.values()].flatMap(polygon => {
    if (!polygon.outer || polygon.outer.points.length < 3) return []
    const outerPoints = polygon.outer.points.map(value => new THREE.Vector2(value.x, -value.z))
    if (!THREE.ShapeUtils.isClockWise(outerPoints)) outerPoints.reverse()
    const shape = new THREE.Shape(outerPoints)
    for (const contour of polygon.holes) {
      if (contour.points.length < 3) continue
      const holePoints = contour.points.map(value => new THREE.Vector2(value.x, -value.z))
      if (THREE.ShapeUtils.isClockWise(holePoints)) holePoints.reverse()
      shape.holes.push(new THREE.Path(holePoints))
    }
    return [shape]
  })
}

function RoomSelectionShape({ room, roomLookup, y }) {
  const geometries = useMemo(() => roomSelectionShapes(room, roomLookup).map(shape => {
    const geometry = new THREE.ShapeGeometry(shape)
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }), [room, roomLookup])
  useEffect(() => () => geometries.forEach(geometry => geometry.dispose()), [geometries])
  if (geometries.length === 0) return null
  return (
    <>
      {geometries.map((geometry, index) => (
        <mesh key={`selection:${index}`} geometry={geometry} position={[0, y, 0]}>
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.36} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}

function RoomWallSelectionOverlay({ room, displayLevel, selectedKeys, onToggle }) {
  if (!room) return null
  const selected = new Set(selectedKeys || [])
  const y = levelToY(displayLevel)
  const thickness = Math.max(2, Number(room.wallThickness) || 1)
  return getRoomBoundaryWallRuns(room).map(wallRun => {
    const wall = {
      axis: wallRun.axis,
      x0: wallRun.from.x * SURFACE_FINE,
      x1: wallRun.to.x * SURFACE_FINE,
      z0: wallRun.from.z * SURFACE_FINE,
      z1: wallRun.to.z * SURFACE_FINE,
      y,
      height: STORY_HEIGHT,
      thickness,
    }
    const box = getWallRenderBox(wall)
    const active = wallRun.edgeKeys.every(key => selected.has(key))
    return (
      <mesh
        key={wallRun.id}
        position={box.position}
        rotation={[0, box.rotationY || 0, 0]}
        renderOrder={42}
        onPointerDown={event => {
          event.stopPropagation()
          onToggle(wallRun.edgeKeys, event)
        }}
      >
        <boxGeometry args={[box.args[0], box.args[1], Math.max(box.args[2], 0.12)]} />
        <meshBasicMaterial
          color={active ? '#fb923c' : '#22d3ee'}
          transparent
          opacity={active ? 0.72 : 0.24}
          depthWrite={false}
        />
      </mesh>
    )
  })
}

function RoomArcPreview({ room, displayLevel, selectedKeys, angleDegrees, sideMultiplier }) {
  const preview = useMemo(() => {
    const built = makeRoomBoundaryArc(room, selectedKeys, angleDegrees, sideMultiplier)
    if (built.error) return null
    const points = sampleRoomBoundaryArc(built.arc)
    return points.slice(0, -1).map((from, index) => ({
      from,
      to: points[index + 1],
    }))
  }, [angleDegrees, room, selectedKeys, sideMultiplier])
  if (!preview) return null

  const y = levelToY(displayLevel)
  const thickness = Math.max(2, Number(room.wallThickness) || 1)
  return preview.map((segment, index) => {
    const box = getWallRenderBox({
      axis: 'segment',
      x0: segment.from.x * SURFACE_FINE,
      x1: segment.to.x * SURFACE_FINE,
      z0: segment.from.z * SURFACE_FINE,
      z1: segment.to.z * SURFACE_FINE,
      y,
      height: STORY_HEIGHT,
      thickness,
    })
    if (!box) return null
    return (
      <mesh
        key={`room-arc-preview:${index}`}
        position={box.position}
        rotation={[0, box.rotationY || 0, 0]}
        renderOrder={44}
      >
        <boxGeometry args={box.args} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.58} depthWrite={false} />
      </mesh>
    )
  })
}

function CeilingPreview({ selection, surfaceTool }) {
  const area = normalizeCellSelection(selection)
  if (!area) return null

  const y = getToolElevation(surfaceTool) + getToolCeilingHeight(surfaceTool)
  const thickness = getToolCeilingThickness(surfaceTool)

  return (
    <mesh position={[area.minX + area.width / 2, y, area.minZ + area.depth / 2]}>
      <boxGeometry args={[area.width, thickness, area.depth]} />
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.28} depthWrite={false} />
    </mesh>
  )
}

function EffectVolumePreview({ selection, surfaceTool }) {
  const area = normalizeCellSelection(selection)
  if (!area) return null
  const baseY = getToolElevation(surfaceTool)
  const height = Math.max(0.1, Number(surfaceTool?.effectHeight) || STORY_HEIGHT)
  return (
    <mesh position={[area.minX + area.width / 2, baseY + height / 2, area.minZ + area.depth / 2]} renderOrder={36}>
      <boxGeometry args={[area.width, height, area.depth]} />
      <meshBasicMaterial color="#fb7185" transparent opacity={0.2} depthWrite={false} />
    </mesh>
  )
}

function RuntimeEffectRegions({ regions = [], surfaceData, displayLevel = 0 }) {
  return regions.map(region => {
    const bounds = region?.bounds
    const sliceBottom = levelToY(displayLevel)
    const sliceTop = levelToY(displayLevel + 1)
    if (!bounds) return null
    const centerX = (bounds.min.x + bounds.max.x) / 2
    const centerZ = (bounds.min.z + bounds.max.z) / 2
    const intersectsSlice = bounds.max.y > sliceBottom && bounds.min.y < sliceTop
    const visibleInOpenRoom = bounds.max.y <= sliceBottom
      && yToLevel(bounds.min.y) < displayLevel
      && isWorldPointVisibleAtLevel(surfaceData, displayLevel, centerX, centerZ, bounds.min.y)
    if (!intersectsSlice && !visibleInOpenRoom) return null
    const size = [bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z]
    const center = [
      centerX,
      (bounds.min.y + bounds.max.y) / 2,
      centerZ,
    ]
    return (
      <mesh key={region.id} position={center} renderOrder={20}>
        <boxGeometry args={size} />
        <meshBasicMaterial color={region.definitionKey === 'gas' ? '#a3e635' : region.definitionKey === 'flooded' ? '#38bdf8' : '#fb7185'} transparent opacity={0.13} depthWrite={false} />
      </mesh>
    )
  })
}

function WallPreview({ drag, surfaceTool, activeMaterial, availableBlocks }) {
  const walls = makeWallsFromDrag(drag?.start, drag?.end, surfaceTool, activeMaterial, availableBlocks)
  if (!walls?.length) return null

  return (
    <>
      {walls.map(wall => {
        const box = getWallRenderBox(wall)
        if (!box) return null
        return (
          <mesh key={wall.id} position={box.position} rotation={[0, box.rotationY || 0, 0]}>
            <boxGeometry args={box.args} />
            <meshBasicMaterial color="#5b8dee" transparent opacity={0.28} depthWrite={false} />
          </mesh>
        )
      })}
    </>
  )
}

function StairPreview({ drag, surfaceTool, activeMaterial, availableBlocks }) {
  const stair = makeStairFromSelection(drag, surfaceTool, activeMaterial, availableBlocks)
  if (!stair) return null

  return (
    <>
      {stairStepBoxes(stair).map((step, index) => (
        <mesh key={index} position={step.position}>
          <boxGeometry args={step.args} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

function ConnectorPreview({ drag, surfaceData, surfaceTool }) {
  if (!drag) return null
  const connector = surfaceTool?.connectorType === 'door'
    ? makeDoorConnectorFromWallPoint(surfaceData, drag.end, surfaceTool)
    : surfaceTool?.connectorType === 'ladder'
      ? makeLadderConnectorFromCell(surfaceData, drag.end, surfaceTool)
      : makeElevatorConnectorFromCell(surfaceData, drag.end, surfaceTool)
  if (!connector) return null

  if (connector.type === 'door') {
    const fine = SURFACE_FINE
    const wallDepth = Math.max(0.28, (Number(connector.thickness) || 1) / fine + 0.12)
    const x0 = Number(connector.x0) / fine
    const x1 = Number(connector.x1) / fine
    const z0 = Number(connector.z0) / fine
    const z1 = Number(connector.z1) / fine
    const width = connector.axis === 'x' ? Math.max(0.2, Math.abs(x1 - x0)) : wallDepth
    const depth = connector.axis === 'z' ? Math.max(0.2, Math.abs(z1 - z0)) : wallDepth
    const x = connector.axis === 'x' ? (x0 + x1) / 2 : x0
    const z = connector.axis === 'z' ? (z0 + z1) / 2 : z0
    const height = Number(connector.height) || 2
    return (
      <mesh position={[x, connector.y + height / 2, z]} renderOrder={35}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    )
  }

  const height = Math.max(0.2, (Number(connector.topY) || connector.y + STORY_HEIGHT) - (Number(connector.y) || 0))
  return (
    <mesh position={[connector.x + 0.5, connector.y + height / 2, connector.z + 0.5]} renderOrder={35}>
      <boxGeometry args={[1, height, 1]} />
      <meshBasicMaterial color="#a78bfa" transparent opacity={0.34} depthWrite={false} />
    </mesh>
  )
}

export default function SurfaceEditorScene({
  surfaceData,
  onSurfaceDataChange,
  textureMaterials,
  activeMaterial,
  surfaceTool,
  onSurfaceToolChange,
  availableBlocks,
  displayLevel = 0,
  selectedConnectorId = null,
  onSurfaceConnectorSelect,
  runtimeEffectRegions = [],
  runtimeFeatureStates = {},
  onRuntimeEffectCreate,
}) {
  const { camera, gl } = useThree()
  const orbitRef = useRef()
  const previousDisplayLevelRef = useRef(displayLevel)
  const roomWallPanels = useMemo(
    () => roomsWallSegments(normalizeSurfaceData(surfaceData).rooms),
    [surfaceData],
  )
  const raycaster = useRef(new THREE.Raycaster())
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const dragRef = useRef(null)
  const dragFrameRef = useRef(null)
  const pendingDragRef = useRef(null)
  const skipNextCanvasMouseDownRef = useRef(false)
  const [drag, setDrag] = useState(null)
  const [hoverPreview, setHoverPreview] = useState(null)

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

  const getWorldPoint = useCallback((clientX, clientY) => {
    groundPlane.current.constant = -getEditPlaneY(surfaceTool)
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.current.setFromCamera(mouse, camera)
    const target = new THREE.Vector3()
    const hit = raycaster.current.ray.intersectPlane(groundPlane.current, target)
    return hit ? target : null
  }, [camera, gl, surfaceTool])

  const getFloorCell = useCallback((clientX, clientY) => {
    const point = getWorldPoint(clientX, clientY)
    if (!point) return null
    const x = Math.floor(point.x)
    const z = Math.floor(point.z)
    if (Math.abs(x) > GRID_SIZE / 2 || Math.abs(z) > GRID_SIZE / 2) return null
    return { x, z }
  }, [getWorldPoint])

  const getWallPoint = useCallback((clientX, clientY) => {
    const point = getWorldPoint(clientX, clientY)
    if (!point) return null
    if (Math.abs(point.x) > GRID_SIZE / 2 || Math.abs(point.z) > GRID_SIZE / 2) return null

    const surface = normalizeSurfaceData(surfaceData)
    const level = getToolElevation(surfaceTool)
    const wallEndMargin = getToolWallThicknessFine(surfaceTool) / (2 * SURFACE_FINE)
    const alongMargin = Math.max(WALL_STICKY_THRESHOLD, wallEndMargin)
    let best = null

    const considerEdges = (edges) => {
      for (const edge of edges) {
        if (edge.distance > WALL_STICKY_THRESHOLD) continue
        if (!inRangeWithMargin(edge.along, edge.min, edge.max, alongMargin)) continue
        if (best && edge.distance >= best.distance) continue
        const along = clamp(edge.along, edge.min, edge.max)
        best = edge.line === 'z'
          ? { distance: edge.distance, fx: Math.round(along * SURFACE_FINE), fz: edge.value * SURFACE_FINE }
          : { distance: edge.distance, fx: edge.value * SURFACE_FINE, fz: Math.round(along * SURFACE_FINE) }
      }
    }

    for (const panel of roomWallPanels) {
      if (!sameLevel(panel.y, level)) continue
      if (panel.axis === 'x') {
        const min = Math.min(Number(panel.x0), Number(panel.x1)) / SURFACE_FINE
        const max = Math.max(Number(panel.x0), Number(panel.x1)) / SURFACE_FINE
        const value = Number(panel.z0) / SURFACE_FINE
        considerEdges([{ line: 'z', value, min, max, distance: Math.abs(point.z - value), along: point.x }])
      } else if (panel.axis === 'z') {
        const min = Math.min(Number(panel.z0), Number(panel.z1)) / SURFACE_FINE
        const max = Math.max(Number(panel.z0), Number(panel.z1)) / SURFACE_FINE
        const value = Number(panel.x0) / SURFACE_FINE
        considerEdges([{ line: 'x', value, min, max, distance: Math.abs(point.x - value), along: point.z }])
      }
    }

    for (const [id, floor] of Object.entries(surface.floors)) {
      const parsed = parseFloorKey(id, floor)
      if (!sameLevel(parsed.y, level)) continue

      considerEdges([
        { line: 'z', value: parsed.z, min: parsed.x, max: parsed.x + 1, distance: Math.abs(point.z - parsed.z), along: point.x },
        { line: 'z', value: parsed.z + 1, min: parsed.x, max: parsed.x + 1, distance: Math.abs(point.z - (parsed.z + 1)), along: point.x },
        { line: 'x', value: parsed.x, min: parsed.z, max: parsed.z + 1, distance: Math.abs(point.x - parsed.x), along: point.z },
        { line: 'x', value: parsed.x + 1, min: parsed.z, max: parsed.z + 1, distance: Math.abs(point.x - (parsed.x + 1)), along: point.z },
      ])
    }

    if (best) return { fx: best.fx, fz: best.fz, sticky: true }

    const fx = Math.round(point.x * SURFACE_FINE)
    const fz = Math.round(point.z * SURFACE_FINE)
    return { fx, fz }
  }, [getWorldPoint, roomWallPanels, surfaceData, surfaceTool])

  const findConnectorAtWorldPoint = useCallback((point, level) => {
    if (!point) return null
    const surface = normalizeSurfaceData(surfaceData)
    let best = null
    for (const [id, connector] of Object.entries(surface.connectors || {})) {
      const connectorLevel = Number.isFinite(Number(connector?.level))
        ? Number(connector.level)
        : Math.round((Number(connector?.y) || 0) / STORY_HEIGHT)
      if (connectorLevel !== level) continue

      let minX
      let maxX
      let minZ
      let maxZ
      if (connector?.type === 'door') {
        const depth = Math.max(
          0.24,
          Number(connector?.modelGeometry?.depth) || Number(connector?.depth) || (Number(connector?.thickness) || 1) / SURFACE_FINE,
        )
        const margin = depth / 2 + 0.16
        if (connector.axis === 'x') {
          minX = Math.min(Number(connector.x0), Number(connector.x1)) / SURFACE_FINE
          maxX = Math.max(Number(connector.x0), Number(connector.x1)) / SURFACE_FINE
          const z = Number(connector.z0) / SURFACE_FINE
          minZ = z - margin
          maxZ = z + margin
        } else {
          const x = Number(connector.x0) / SURFACE_FINE
          minX = x - margin
          maxX = x + margin
          minZ = Math.min(Number(connector.z0), Number(connector.z1)) / SURFACE_FINE
          maxZ = Math.max(Number(connector.z0), Number(connector.z1)) / SURFACE_FINE
        }
      } else if (connector?.type === 'elevator' || connector?.type === 'ladder') {
        minX = Number(connector.x)
        maxX = minX + 1
        minZ = Number(connector.z)
        maxZ = minZ + 1
      } else {
        continue
      }

      if (point.x < minX || point.x > maxX || point.z < minZ || point.z > maxZ) continue
      const centerX = (minX + maxX) / 2
      const centerZ = (minZ + maxZ) / 2
      const distance = Math.hypot(point.x - centerX, point.z - centerZ)
      if (best && distance >= best.distance) continue
      best = { id, connector: { id, ...connector }, distance }
    }
    return best
  }, [surfaceData])

  const handleConnectorPointerSelect = useCallback((connectorId, connector, event) => {
    if (!connectorId || surfaceTool?.mode !== 'select') return
    skipNextCanvasMouseDownRef.current = true
    const nativeEvent = event?.nativeEvent || event?.sourceEvent || event || {}
    const clientX = Number.isFinite(Number(nativeEvent.clientX)) ? Number(nativeEvent.clientX) : 24
    const clientY = Number.isFinite(Number(nativeEvent.clientY)) ? Number(nativeEvent.clientY) : 24
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
    onSurfaceConnectorSelect?.(connectorId, clientX, clientY, connector)
  }, [onSurfaceConnectorSelect, onSurfaceToolChange, surfaceTool])

  const handleRoomWallPointerSelect = useCallback((edgeKeys, event) => {
    if (!edgeKeys?.length || !surfaceTool?.roomWallEdit || !surfaceTool?.selectedRoomId) return
    skipNextCanvasMouseDownRef.current = true
    const selected = new Set(surfaceTool?.selectedRoomWallKeys || [])
    const remove = edgeKeys.every(key => selected.has(key))
    for (const key of edgeKeys) {
      if (remove) selected.delete(key)
      else selected.add(key)
    }
    const room = surfaceData.rooms?.[surfaceTool.selectedRoomId]
    const selectedRoomWallCount = room
      ? getRoomBoundaryWallRuns(room).filter(run => run.edgeKeys.every(key => selected.has(key))).length
      : 0
    onSurfaceToolChange?.({
      ...surfaceTool,
      mode: 'select',
      selectedRoomWallKeys: [...selected],
      selectedRoomWallCount,
      roomArcError: null,
    })
    event?.stopPropagation?.()
  }, [onSurfaceToolChange, surfaceData.rooms, surfaceTool])

  useEffect(() => {
    const canvas = gl.domElement
    const view = canvas.ownerDocument.defaultView
    const preventContextMenu = (e) => e.preventDefault()

    const clearPendingDrag = () => {
      pendingDragRef.current = null
      if (dragFrameRef.current !== null) {
        view.cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }
    }

    const scheduleDragPreview = (nextDrag) => {
      pendingDragRef.current = nextDrag
      if (dragFrameRef.current !== null) return
      dragFrameRef.current = view.requestAnimationFrame(() => {
        dragFrameRef.current = null
        const pendingDrag = pendingDragRef.current
        pendingDragRef.current = null
        if (pendingDrag) setDrag(pendingDrag)
      })
    }

    const cancelDrag = (e) => {
      if (!dragRef.current) return false
      dragRef.current = null
      clearPendingDrag()
      setDrag(null)
      setHoverPreview(null)
      e.preventDefault()
      e.stopPropagation()
      return true
    }

    const handleMouseDown = (e) => {
      if (e.button === 2 && cancelDrag(e)) return
      if (e.button !== 0) return
      if (skipNextCanvasMouseDownRef.current) {
        skipNextCanvasMouseDownRef.current = false
        e.preventDefault()
        e.stopPropagation()
        return
      }
      const mode = surfaceTool?.mode || 'select'
      const usesWallPoint = mode === 'wall' || (mode === 'connector' && surfaceTool?.connectorType === 'door')
      const start = usesWallPoint
        ? getWallPoint(e.clientX, e.clientY)
        : getFloorCell(e.clientX, e.clientY)
      if (!start) return

      const nextDrag = { mode, start, end: start }
      dragRef.current = nextDrag
      clearPendingDrag()
      setDrag(nextDrag)
      setHoverPreview(null)
      e.preventDefault()
    }

    const handleMouseMove = (e) => {
      if (!dragRef.current) {
        if (surfaceTool?.mode === 'connector') {
          const usesWallPoint = surfaceTool?.connectorType === 'door'
          const point = usesWallPoint
            ? getWallPoint(e.clientX, e.clientY)
            : getFloorCell(e.clientX, e.clientY)
          setHoverPreview(prev => {
            if (!point) return prev ? null : prev
            const next = { mode: 'connector', start: point, end: point }
            const same = usesWallPoint
              ? prev?.end?.fx === point.fx && prev?.end?.fz === point.fz
              : prev?.end?.x === point.x && prev?.end?.z === point.z
            return same ? prev : next
          })
        } else {
          setHoverPreview(prev => (prev ? null : prev))
        }
        return
      }
      setHoverPreview(prev => (prev ? null : prev))
      if ((e.buttons & 2) !== 0 && cancelDrag(e)) return
      const mode = dragRef.current.mode
      const usesWallPoint = mode === 'wall' || (mode === 'connector' && surfaceTool?.connectorType === 'door')
      const end = usesWallPoint
        ? getWallPoint(e.clientX, e.clientY)
        : getFloorCell(e.clientX, e.clientY)
      if (!end) return
      const previousEnd = dragRef.current.end
      const usesFinePoint = mode === 'wall' || (mode === 'connector' && surfaceTool?.connectorType === 'door')
      const unchanged = usesFinePoint
        ? previousEnd.fx === end.fx && previousEnd.fz === end.fz
        : previousEnd.x === end.x && previousEnd.z === end.z
      if (unchanged) return

      const nextDrag = { ...dragRef.current, end }
      dragRef.current = nextDrag
      scheduleDragPreview(nextDrag)
    }

    const handleMouseUp = (e) => {
      if (e.button !== 0) return
      const currentDrag = dragRef.current
      if (!currentDrag) return

      const mode = currentDrag.mode
      const usesWallPoint = mode === 'wall' || (mode === 'connector' && surfaceTool?.connectorType === 'door')
      const end = usesWallPoint
        ? (getWallPoint(e.clientX, e.clientY) || currentDrag.end)
        : (getFloorCell(e.clientX, e.clientY) || currentDrag.end)
      const finalDrag = { ...currentDrag, end }
      dragRef.current = null
      clearPendingDrag()
      setDrag(null)

      const editLevel = Math.round(getToolElevation(surfaceTool) / STORY_HEIGHT)
      const isSingleCell = finalDrag.start?.x === finalDrag.end?.x
        && finalDrag.start?.z === finalDrag.end?.z

      if (mode === 'select') {
        if (isSingleCell) {
          const clickPoint = getWorldPoint(e.clientX, e.clientY)
          const connectorHit = findConnectorAtWorldPoint(clickPoint, editLevel)
          if (connectorHit) {
            onSurfaceToolChange?.({
              ...surfaceTool,
              mode: 'select',
              selectedRoomId: null,
              selectedRoomIds: [],
              selectedConnectorId: connectorHit.id,
              roomWallEdit: false,
              selectedRoomWallKeys: [],
              selectedRoomWallCount: 0,
              roomArcError: null,
            })
            onSurfaceConnectorSelect?.(connectorHit.id, e.clientX, e.clientY)
            e.preventDefault()
            e.stopPropagation()
            return
          }
        }

        const hits = isSingleCell
          ? [findRoomAtCell(surfaceData, finalDrag.end, editLevel)].filter(Boolean)
          : findRoomsInSelection(surfaceData, finalDrag, editLevel)

        if (hits.length === 1 && hits[0]?.room) {
          const patch = roomToSurfaceToolPatch(hits[0].room)
          if (patch) {
            onSurfaceToolChange?.({
              ...surfaceTool,
              ...patch,
              mode: 'select',
              selectedRoomId: hits[0].id,
              selectedRoomIds: [hits[0].id],
              selectedConnectorId: null,
              roomWallEdit: false,
              selectedRoomWallKeys: [],
              selectedRoomWallCount: 0,
              roomArcError: null,
            })
          }
        } else {
          onSurfaceToolChange?.({
            ...surfaceTool,
            mode: 'select',
            selectedRoomId: null,
            selectedRoomIds: hits.map(hit => hit.id),
            selectedConnectorId: null,
            roomWallEdit: false,
            selectedRoomWallKeys: [],
            selectedRoomWallCount: 0,
            roomArcError: null,
          })
        }
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (mode === 'room') {
        const nextData = applyRoomSelection(surfaceData, finalDrag, surfaceTool, activeMaterial, availableBlocks)
        if (nextData !== surfaceData) {
          onSurfaceDataChange(nextData)
          onSurfaceToolChange?.({
            ...surfaceTool,
            mode: 'room',
            selectedRoomId: null,
            selectedRoomIds: [],
            selectedConnectorId: null,
          })
        } else {
          onSurfaceToolChange?.({ ...surfaceTool, mode: 'room', selectedConnectorId: null })
        }
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (mode === 'connector') {
        const nextData = surfaceTool?.connectorType === 'door'
          ? applyDoorConnector(surfaceData, finalDrag.end, surfaceTool)
          : surfaceTool?.connectorType === 'ladder'
            ? applyLadderConnector(surfaceData, finalDrag.end, surfaceTool)
            : applyElevatorConnector(surfaceData, finalDrag.end, surfaceTool)
        if (nextData !== surfaceData) onSurfaceDataChange(nextData)
        onSurfaceToolChange?.({ ...surfaceTool, mode: 'select' })
        setHoverPreview(null)
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (mode === 'effect') {
        const area = normalizeCellSelection(finalDrag)
        if (area) {
          const baseY = getToolElevation(surfaceTool)
          const height = Math.max(0.1, Number(surfaceTool?.effectHeight) || STORY_HEIGHT)
          onRuntimeEffectCreate?.({
            definitionKey: surfaceTool?.effectDefinitionKey || 'fire',
            targetKind: 'volume',
            volume: {
              min: { x: area.minX, y: baseY, z: area.minZ },
              max: { x: area.maxX + 1, y: baseY + height, z: area.maxZ + 1 },
            },
            intensity: Math.max(0.01, Number(surfaceTool?.effectIntensity) || 1),
            source: { kind: 'editor' },
          })
        }
        setHoverPreview(null)
        e.preventDefault()
        e.stopPropagation()
        return
      }

      const nextData = mode === 'wall'
        ? applyWallDrag(surfaceData, finalDrag.start, finalDrag.end, surfaceTool, activeMaterial, availableBlocks)
        : mode === 'stair'
          ? applyStairSelection(surfaceData, finalDrag, surfaceTool, activeMaterial, availableBlocks)
        : mode === 'bridge'
          ? applyBridgeSelection(surfaceData, finalDrag, surfaceTool, activeMaterial, availableBlocks)
        : mode === 'ceiling'
          ? applyCeilingSelection(surfaceData, finalDrag, surfaceTool, activeMaterial, availableBlocks)
        : mode === 'erase'
          ? eraseSurfaceSelection(surfaceData, finalDrag, surfaceTool)
          : applyFloorSelection(surfaceData, finalDrag, surfaceTool, activeMaterial, availableBlocks)
      if (nextData !== surfaceData) onSurfaceDataChange(nextData)
    }

    canvas.addEventListener('contextmenu', preventContextMenu)
    canvas.addEventListener('mousedown', handleMouseDown, true)
    canvas.addEventListener('mousemove', handleMouseMove, true)
    canvas.addEventListener('mouseup', handleMouseUp)
    return () => {
      clearPendingDrag()
      canvas.removeEventListener('contextmenu', preventContextMenu)
      canvas.removeEventListener('mousedown', handleMouseDown, true)
      canvas.removeEventListener('mousemove', handleMouseMove, true)
      canvas.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    gl,
    surfaceTool,
    surfaceData,
    activeMaterial,
    availableBlocks,
    findConnectorAtWorldPoint,
    onRuntimeEffectCreate,
    getFloorCell,
    getWallPoint,
    getWorldPoint,
    onSurfaceConnectorSelect,
    onSurfaceDataChange,
    onSurfaceToolChange,
  ])

  useEffect(() => {
    if (!orbitRef.current) return
    orbitRef.current.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    }
  }, [])

  const gridElevation = getEditPlaneY(surfaceTool)
  const normalizedSurface = normalizeSurfaceData(surfaceData)
  const selectedRoomIds = surfaceTool?.selectedRoomIds?.length
    ? surfaceTool.selectedRoomIds
    : surfaceTool?.selectedRoomId
      ? [surfaceTool.selectedRoomId]
      : []
  const selectedRooms = selectedRoomIds
    .map(id => (normalizedSurface.rooms?.[id] ? { id, ...normalizedSurface.rooms[id] } : null))
    .filter(room => {
      if (!room) return false
      const baseLevel = Math.round(getRoomBaseY(room) / STORY_HEIGHT)
      return displayLevel >= baseLevel && displayLevel < baseLevel + getRoomHeightLevels(room)
    })
  const connectorPreview = drag?.mode === 'connector'
    ? drag
    : surfaceTool?.mode === 'connector' && hoverPreview?.mode === 'connector'
      ? hoverPreview
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
        position={[0, gridElevation + 0.01, 0]}
        cellColor="#334155"
        sectionColor="#475569"
        fadeDistance={80}
      />
      <Grid
        args={[GRID_SIZE, GRID_SIZE * SURFACE_FINE]}
        position={[0, gridElevation + 0.02, 0]}
        cellColor="#233044"
        sectionColor="#233044"
        fadeDistance={45}
      />
      <SurfaceDungeonScene
        surfaceData={surfaceData}
        textureMaterials={textureMaterials}
        showWater={false}
        ceilingOpacity={0.35}
        displayLevel={displayLevel}
        showDetails
        selectedConnectorId={selectedConnectorId || surfaceTool?.selectedConnectorId}
        onConnectorSelect={surfaceTool?.mode === 'select' ? handleConnectorPointerSelect : null}
        runtimeFeatureStates={runtimeFeatureStates}
      />
      <RuntimeEffectRegions regions={runtimeEffectRegions} surfaceData={surfaceData} displayLevel={displayLevel} />
      {selectedRooms.map(room => (
        <SelectedRoomOverlay key={room.id} room={room} roomLookup={surfaceData.rooms} />
      ))}
      {surfaceTool?.roomWallEdit && selectedRooms.length === 1 && (
        <>
          <RoomWallSelectionOverlay
            room={selectedRooms[0]}
            displayLevel={displayLevel}
            selectedKeys={surfaceTool?.selectedRoomWallKeys}
            onToggle={handleRoomWallPointerSelect}
          />
          {(surfaceTool?.selectedRoomWallCount || 0) >= 2 && (
            <RoomArcPreview
              room={selectedRooms[0]}
              displayLevel={displayLevel}
              selectedKeys={surfaceTool?.selectedRoomWallKeys}
              angleDegrees={surfaceTool?.roomArcAngle}
              sideMultiplier={surfaceTool?.roomArcSide}
            />
          )}
        </>
      )}
      {drag?.mode === 'wall' ? (
        <WallPreview drag={drag} surfaceTool={surfaceTool} activeMaterial={activeMaterial} availableBlocks={availableBlocks} />
      ) : drag?.mode === 'stair' ? (
        <StairPreview drag={drag} surfaceTool={surfaceTool} activeMaterial={activeMaterial} availableBlocks={availableBlocks} />
      ) : drag?.mode === 'ceiling' ? (
        <CeilingPreview selection={drag} surfaceTool={surfaceTool} />
      ) : drag?.mode === 'effect' ? (
        <EffectVolumePreview selection={drag} surfaceTool={surfaceTool} />
      ) : drag?.mode === 'room' ? (
        <RoomPreview selection={drag} surfaceTool={surfaceTool} />
      ) : drag?.mode === 'select' ? (
        <SelectionPreview selection={drag} surfaceTool={surfaceTool} />
      ) : drag ? (
        <FloorPreview selection={drag} surfaceTool={surfaceTool} />
      ) : (
        null
      )}
      {connectorPreview && (
        <ConnectorPreview drag={connectorPreview} surfaceData={surfaceData} surfaceTool={surfaceTool} />
      )}
    </>
  )
}
