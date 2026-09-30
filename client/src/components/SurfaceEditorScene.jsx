// SurfaceEditorScene.jsx — imports corrigés pour le plan de refactor

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Grid, Line, MapControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import SurfaceDungeonScene, { ConnectorSegment } from './SurfaceDungeonScene.jsx'

// Modules refactorisés
import {
  normalizeSurfaceData,
  normalizeCellSelection,
  computeSurfaceGridExtent,
  applyRoomSelectionWithResult,
  findRoomAtCell,
  findRoomsInSelection,
  roomToSurfaceToolPatch,
  isWorldPointVisibleAtLevel,
  parseFloorKey,
  SURFACE_FINE,
  getToolElevation,
  paintRoomWallEdges,
  paintRoomWallRoom,
  roomWallEdgeKeyAtPoint,
  paintRoomFootprintCells,
} from '../lib/surfaceData.js' // Fonctions restées dans surfaceData.js

import {
  STORY_HEIGHT,
  levelToY,
  yToLevel,
  getRoomBaseY,
  getRoomFootprintCells,
  roomCellKey,
} from '../lib/surfaceCore.js'

import { roomsWallSegments } from '../lib/roomWalls.js'

import {
  applyDoorConnector,
  applyElevatorConnector,
  applyLadderConnector,
} from '../lib/connectors.js'

import {
  getWallRenderBox,
  getToolWallThicknessFine,
} from '../lib/surfaceGeometry.js'
import { getEffectRegionColor } from '../lib/effectRegionColors.js'
import { applyToolMode } from '../lib/surfaceTools/applyToolMode.js'

import FloorPreview from './surfaceTools/FloorPreview.jsx'
import RoomPreview from './surfaceTools/RoomPreview.jsx'
import SelectionPreview from './surfaceTools/SelectionPreview.jsx'
import WallPreview from './surfaceTools/WallPreview.jsx'
import StairPreview from './surfaceTools/StairPreview.jsx'
import EffectVolumePreview from './surfaceTools/EffectVolumePreview.jsx'
import RoomFootprintPaintPreview from './surfaceTools/RoomFootprintPaintPreview.jsx'
import ConnectorPreview from './surfaceTools/ConnectorPreview.jsx'

import {
  makeRoomBoundaryArc,
  roomBoundaryContours,
  roomSelectableWallRuns,
  roomSliceContours,
  sampleRoomBoundaryArc,
  wallRunReshapeCells,
  wallRunRowCountForCell,
} from '../../../shared/world/roomGeometry.js'

const GRID_SIZE = 50
const WALL_STICKY_THRESHOLD = 0.18
// Poignée de redimensionnement (§10c/§12.9) : distance minimale en pixels écran entre le clic et le
// relâchement pour compter comme un glissé plutôt qu'un simple re-clic sur un mur déjà sélectionné —
// sans ce seuil, un clic immobile pourrait pousser le mur d'une rangée par accident (aucune position
// « neutre » n'existe dans wallRunReshapeCells, la limite est toujours une arête entre deux cases).
const WALL_RESHAPE_CLICK_THRESHOLD_PX = 6

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

// FloorPreview, RoomPreview, SelectionPreview, WallPreview, StairPreview, EffectVolumePreview :
// extraits dans components/surfaceTools/ (§11.7, PLAN_WORLD_BUILDER_REWORK.md — décomposition en un
// fichier par responsabilité, composants purs pilotés uniquement par leurs props).

function SelectedRoomOverlay({ room, roomLookup, displayLevel }) {
  if (!room) return null
  const y = levelToY(displayLevel) + 0.08

  return (
    <group renderOrder={30}>
      <RoomSelectionShape room={room} roomLookup={roomLookup} y={y} displayLevel={displayLevel} />
      <RoomSelectionContour room={room} roomLookup={roomLookup} y={y + 0.025} displayLevel={displayLevel} />
    </group>
  )
}

function roomSelectionShapes(room, roomLookup, displayLevel = null) {
  const baseLevel = yToLevel(getRoomBaseY(room))
  const sliceContours = displayLevel === null
    ? []
    : roomSliceContours(room, displayLevel - baseLevel, roomLookup, STORY_HEIGHT)
  const contours = sliceContours.length > 0 ? sliceContours : roomBoundaryContours(room, roomLookup)
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

function RoomSelectionShape({ room, roomLookup, y, displayLevel = null }) {
  const geometries = useMemo(() => roomSelectionShapes(room, roomLookup, displayLevel).map(shape => {
    const geometry = new THREE.ShapeGeometry(shape)
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }), [displayLevel, room, roomLookup])
  useEffect(() => () => geometries.forEach(geometry => geometry.dispose()), [geometries])
  if (geometries.length === 0) return null
  return (
    <>
      {geometries.map((geometry, index) => (
        <mesh key={`selection:${index}`} geometry={geometry} position={[0, y, 0]}>
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.14} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}

function RoomSelectionContour({ room, roomLookup, y, displayLevel = null }) {
  const contours = useMemo(() => {
    const baseLevel = yToLevel(getRoomBaseY(room))
    const sliced = displayLevel === null
      ? []
      : roomSliceContours(room, displayLevel - baseLevel, roomLookup, STORY_HEIGHT)
    return sliced.length > 0 ? sliced : roomBoundaryContours(room, roomLookup)
  }, [displayLevel, room, roomLookup])
  return contours.map((contour, index) => {
    if (contour.points.length < 2) return null
    const points = [...contour.points, contour.points[0]].map(point => [point.x, y, point.z])
    return (
      <Line
        key={`selection-contour:${contour.polygonIndex}:${contour.isHole ? 'hole' : 'outer'}:${index}`}
        points={points}
        color="#fbbf24"
        lineWidth={2}
        transparent
        opacity={0.9}
        depthTest={false}
        renderOrder={31}
      />
    )
  })
}

function SelectableRoomWall({ wall, displayLevel, thickness, active, onToggle, onReshapeStart, interactive = true }) {
  const [hovered, setHovered] = useState(false)
  const points = wall.axis === 'arc' ? wall.points : [wall.from, wall.to]
  const y = levelToY(displayLevel)
  const segments = points.slice(0, -1).map((from, index) => ({ from, to: points[index + 1] }))
  const linePoints = points.map(point => [point.x, y + STORY_HEIGHT + 0.045, point.z])
  const showLine = active || hovered

  return (
    <group
      onPointerDown={event => {
        if (!interactive) return
        event.stopPropagation()
        // Poignée de redimensionnement (§10c/§12.9) : un tronçon DROIT déjà sélectionné se saisit
        // et se glisse pour pousser tout le mur d'un coup — un premier clic (pas encore actif) ne
        // fait toujours que sélectionner, comportement inchangé. Jamais sur un arc (v1, non traité).
        if (active && wall.axis !== 'arc' && onReshapeStart) {
          onReshapeStart(wall, event)
          return
        }
        onToggle?.(wall.edgeKeys, event)
      }}
      onPointerOver={event => {
        if (!interactive) return
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {segments.map((segment, index) => {
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
          <group key={`${wall.id}:hit:${index}`}>
            <mesh
              raycast={interactive ? undefined : () => null}
              position={box.position}
              rotation={[0, box.rotationY || 0, 0]}
              renderOrder={42}
            >
              <boxGeometry args={[box.args[0], box.args[1], Math.max(box.args[2], 0.12)]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
            </mesh>
            {active && (
              <mesh
                position={box.position}
                rotation={[0, box.rotationY || 0, 0]}
                scale={[1.025, 1.025, 1.12]}
                renderOrder={41}
                raycast={() => null}
              >
                <boxGeometry args={box.args} />
                <meshBasicMaterial
                  color="#ffd34d"
                  side={THREE.BackSide}
                  transparent
                  opacity={0.36}
                  blending={THREE.AdditiveBlending}
                  depthTest={false}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            )}
          </group>
        )
      })}
      {showLine && (
        <Line
          points={linePoints}
          color={active ? '#fb923c' : '#22d3ee'}
          lineWidth={active ? 4 : 3}
          transparent
          opacity={active ? 1 : 0.9}
          depthTest={false}
          renderOrder={43}
        />
      )}
    </group>
  )
}

function RoomWallSelectionOverlay({ room, displayLevel, selectedKeys, onToggle, onReshapeStart, interactive = true }) {
  if (!room || room.wallEnabled === false) return null
  const selected = new Set(selectedKeys || [])
  const thickness = Math.max(2, Number(room.wallThickness) || 1)
  return roomSelectableWallRuns(room).map(wallRun => {
    const active = wallRun.edgeKeys.every(key => selected.has(key))
    return (
      <SelectableRoomWall
        key={wallRun.id}
        wall={wallRun}
        displayLevel={displayLevel}
        thickness={thickness}
        active={active}
        onToggle={onToggle}
        onReshapeStart={onReshapeStart}
        interactive={interactive}
      />
    )
  })
}

// Outil « Peindre un mur » — clic direct (pas de sélection préalable), portée choisie explicitement
// par un sélecteur dans le panneau (case / tronçon / salle), jamais par un compteur de clics.
function PaintableRoomWall({ wall, displayLevel, thickness, scope, onPaint }) {
  const [hovered, setHovered] = useState(false)
  const points = wall.axis === 'arc' ? wall.points : [wall.from, wall.to]
  const y = levelToY(displayLevel)
  const segments = points.slice(0, -1).map((from, index) => ({ from, to: points[index + 1] }))
  const linePoints = points.map(point => [point.x, y + STORY_HEIGHT + 0.045, point.z])

  return (
    <group
      onPointerDown={event => {
        event.stopPropagation()
        // event.point est déjà en unités brutes de scène (même repère que wall.from/wall.to) —
        // le mesh cliquable est positionné en brut par getWallRenderBox malgré l'aller-retour par
        // SURFACE_FINE en interne. Diviser ici une deuxième fois (bug d'origine, 2026-09-28)
        // écrasait la position réelle du clic et clampait toujours sur la première case du mur.
        const hitPoint = { x: event.point.x, z: event.point.z }
        const caseKey = scope === 'case' ? roomWallEdgeKeyAtPoint(wall, hitPoint) : null
        const edgeKeys = scope === 'case' && caseKey ? [caseKey] : wall.edgeKeys
        onPaint?.(edgeKeys)
      }}
      onPointerOver={event => {
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {segments.map((segment, index) => {
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
            key={`${wall.id}:paint-hit:${index}`}
            position={box.position}
            rotation={[0, box.rotationY || 0, 0]}
            renderOrder={42}
          >
            <boxGeometry args={[box.args[0], box.args[1], Math.max(box.args[2], 0.6)]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>
        )
      })}
      {hovered && (
        <Line
          points={linePoints}
          color="#22c55e"
          lineWidth={4}
          transparent
          opacity={0.95}
          depthTest={false}
          renderOrder={43}
        />
      )}
    </group>
  )
}

function PaintableRoomWalls({ room, displayLevel, scope, onPaint }) {
  if (!room || room.wallEnabled === false) return null
  const thickness = Math.max(2, Number(room.wallThickness) || 1)
  return roomSelectableWallRuns(room).map(wallRun => (
    <PaintableRoomWall
      key={wallRun.id}
      wall={wallRun}
      displayLevel={displayLevel}
      thickness={thickness}
      scope={scope}
      onPaint={edgeKeys => onPaint?.(room.id, edgeKeys)}
    />
  ))
}

// Aperçu du geste « peindre/effacer des cases » (Solution A, 2026-09-28 — remplace une première
// version « poignée sur mur » : dans ce module, la case est la seule donnée à identité stable
// (`room.cells`) ; le mur n'en a aucune, il est redérivé des cases à chaque compilation. Peindre
// directement des cases, comme Dungeondraft/RimWorld, évite la traduction case → mur → sens/
// magnitude qui avait produit un bug d'échelle silencieux dans la première version).

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
        <meshBasicMaterial color={getEffectRegionColor(region)} transparent opacity={0.13} depthWrite={false} />
      </mesh>
    )
  })
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
  onSurfaceRoomSelect,
  onSurfaceWallSelect,
  runtimeEffectRegions = [],
  runtimeFeatureStates = {},
  onRuntimeEffectCreate,
}) {
  const { t } = useTranslation()
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

  const setPointerRay = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.current.setFromCamera(mouse, camera)
    return raycaster.current.ray
  }, [camera, gl])

  const getWorldPoint = useCallback((clientX, clientY) => {
    groundPlane.current.constant = -getEditPlaneY(surfaceTool)
    const ray = setPointerRay(clientX, clientY)
    const target = new THREE.Vector3()
    const hit = ray.intersectPlane(groundPlane.current, target)
    return hit ? target : null
  }, [setPointerRay, surfaceTool])

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
      } else if (panel.axis === 'segment') {
        const x0 = Number(panel.x0) / SURFACE_FINE
        const z0 = Number(panel.z0) / SURFACE_FINE
        const x1 = Number(panel.x1) / SURFACE_FINE
        const z1 = Number(panel.z1) / SURFACE_FINE
        const dx = x1 - x0
        const dz = z1 - z0
        const lengthSquared = dx * dx + dz * dz
        if (lengthSquared <= 1e-8) continue
        const t = Math.max(0, Math.min(1, ((point.x - x0) * dx + (point.z - z0) * dz) / lengthSquared))
        const x = x0 + dx * t
        const z = z0 + dz * t
        const distance = Math.hypot(point.x - x, point.z - z)
        if (distance > WALL_STICKY_THRESHOLD || (best && distance >= best.distance)) continue
        best = {
          distance,
          fx: x * SURFACE_FINE,
          fz: z * SURFACE_FINE,
        }
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

  const getSelectedDoorWallPoint = useCallback((clientX, clientY) => {
    const selectedRoomId = surfaceTool?.selectedRoomId || null
    const allowedEdgeKeys = new Set(
      (surfaceTool?.connectorWallEdgeKeys || surfaceTool?.selectedRoomWallKeys || []).map(String),
    )

    const ray = setPointerRay(clientX, clientY)
    const levelY = getToolElevation(surfaceTool)
    let best = null

    for (const panel of roomWallPanels) {
      if (!sameLevel(panel.y, levelY)) continue
      if (selectedRoomId && !panel.roomIds?.includes(selectedRoomId)) continue
      if (allowedEdgeKeys.size > 0 && !(panel.sourceEdgeKeys || []).some(key => allowedEdgeKeys.has(String(key)))) continue

      const x0 = Number(panel.x0) / SURFACE_FINE
      const z0 = Number(panel.z0) / SURFACE_FINE
      const x1 = Number(panel.x1) / SURFACE_FINE
      const z1 = Number(panel.z1) / SURFACE_FINE
      const dx = x1 - x0
      const dz = z1 - z0
      const lengthSquared = dx * dx + dz * dz
      if (![x0, z0, x1, z1].every(Number.isFinite) || lengthSquared <= 1e-8) continue

      const length = Math.sqrt(lengthSquared)
      const plane = new THREE.Plane(
        new THREE.Vector3(-dz / length, 0, dx / length),
      ).setFromNormalAndCoplanarPoint(
        new THREE.Vector3(-dz / length, 0, dx / length),
        new THREE.Vector3(x0, Number(panel.y) || 0, z0),
      )
      const hit = ray.intersectPlane(plane, new THREE.Vector3())
      if (!hit) continue

      const bottom = Number(panel.y) || 0
      const top = bottom + Math.max(0.01, Number(panel.height) || STORY_HEIGHT)
      if (hit.y < bottom - 0.08 || hit.y > top + 0.08) continue

      const along = ((hit.x - x0) * dx + (hit.z - z0) * dz) / lengthSquared
      const endMargin = Math.max(0.04, (Number(panel.thickness) || 1) / (2 * SURFACE_FINE)) / length
      if (along < -endMargin || along > 1 + endMargin) continue

      const clampedAlong = clamp(along, 0, 1)
      const distance = hit.distanceToSquared(ray.origin)
      if (best && distance >= best.distance) continue
      best = {
        distance,
        fx: (x0 + dx * clampedAlong) * SURFACE_FINE,
        fz: (z0 + dz * clampedAlong) * SURFACE_FINE,
      }
    }

    return best ? { fx: best.fx, fz: best.fz, sticky: true } : null
  }, [roomWallPanels, setPointerRay, surfaceTool])

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
        if (connector.axis === 'segment') {
          minX = Math.min(Number(connector.x0), Number(connector.x1)) / SURFACE_FINE - margin
          maxX = Math.max(Number(connector.x0), Number(connector.x1)) / SURFACE_FINE + margin
          minZ = Math.min(Number(connector.z0), Number(connector.z1)) / SURFACE_FINE - margin
          maxZ = Math.max(Number(connector.z0), Number(connector.z1)) / SURFACE_FINE + margin
        } else if (connector.axis === 'x') {
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
    if (!edgeKeys?.length || surfaceTool?.mode !== 'select' || !surfaceTool?.selectedRoomId) return
    skipNextCanvasMouseDownRef.current = true
    // Un clic simple REMPLACE la sélection par ce seul mur — sinon la sélection s'accumulait
    // silencieusement à chaque clic (jamais remise à zéro tant qu'on reste sur la même salle), et le
    // panneau flottant Mur applique la couleur en direct sur TOUTE la sélection courante : cliquer sur
    // plusieurs murs l'un après l'autre puis ajuster la couleur repeignait tout ce qui avait été touché
    // depuis, sans qu'aucun clic de peinture n'ait eu lieu (2026-09-29, rapporté par Saar). Maj-clic
    // (Shift) garde l'ancien comportement d'ajout/retrait pour une vraie sélection multiple délibérée —
    // même convention que tout sélecteur (clic = un seul, Maj-clic = étend), déjà celle utilisée pour la
    // sélection de salle (un clic remplace toujours `selectedRoomId`).
    const additive = !!(event?.shiftKey ?? event?.nativeEvent?.shiftKey)
    const previousSelected = additive ? new Set(surfaceTool?.selectedRoomWallKeys || []) : new Set()
    const remove = additive && edgeKeys.every(key => previousSelected.has(key))
    const selected = previousSelected
    for (const key of edgeKeys) {
      if (remove) selected.delete(key)
      else selected.add(key)
    }
    const room = surfaceData.rooms?.[surfaceTool.selectedRoomId]
    const selectedRoomWallCount = room
      ? roomSelectableWallRuns(room).filter(run => run.edgeKeys.every(key => selected.has(key))).length
      : 0
    onSurfaceToolChange?.({
      ...surfaceTool,
      mode: 'select',
      selectedRoomWallKeys: [...selected],
      selectedRoomWallCount,
      roomArcError: null,
    })
    onSurfaceWallSelect?.(surfaceTool.selectedRoomId, selectedRoomWallCount)
    event?.stopPropagation?.()
  }, [onSurfaceToolChange, onSurfaceWallSelect, surfaceData.rooms, surfaceTool])

  // Poignée de redimensionnement (§10c/§12.9, PLAN_WORLD_BUILDER_REWORK.md) — ne se déclenche que
  // sur un tronçon DÉJÀ sélectionné (SelectableRoomWall ne l'appelle que si `active`), jamais sur le
  // tout premier clic : ça élimine toute ambiguïté clic/glissé pour la sélection elle-même, qui reste
  // intégralement gérée par handleRoomWallPointerSelect ci-dessus, inchangée. Suit exactement le
  // patron générique dragRef/setDrag déjà utilisé pour les cases (mode 'reshape-room') plutôt qu'un
  // second système d'événements — seul un nouveau mode ('wall-reshape') est ajouté à handleMouseMove/
  // handleMouseUp ci-dessous, aucune branche existante modifiée.
  const handleWallReshapeStart = useCallback((wallRun, event) => {
    if (surfaceTool?.mode !== 'select' || !surfaceTool?.selectedRoomId) return
    skipNextCanvasMouseDownRef.current = true
    const nativeEvent = event?.nativeEvent || event || {}
    const clientX = Number(nativeEvent.clientX) || 0
    const clientY = Number(nativeEvent.clientY) || 0
    const cell = getFloorCell(clientX, clientY)
    const nextDrag = {
      mode: 'wall-reshape',
      roomId: surfaceTool.selectedRoomId,
      wallRun,
      startClientX: clientX,
      startClientY: clientY,
      end: cell || { x: 0, z: 0 },
    }
    dragRef.current = nextDrag
    setDrag(nextDrag)
    event?.stopPropagation?.()
  }, [surfaceTool, getFloorCell])

  const handlePaintWallClick = useCallback((roomId, edgeKeys) => {
    if (!roomId) return
    const scope = surfaceTool?.wallPaintScope || 'case'
    const result = scope === 'room'
      ? paintRoomWallRoom(surfaceData, roomId, surfaceTool, {
        clearOverrides: !!surfaceTool?.wallPaintClearOverrides,
      })
      : paintRoomWallEdges(surfaceData, roomId, edgeKeys, surfaceTool)
    if (result?.surfaceData && result.surfaceData !== surfaceData) onSurfaceDataChange(result.surfaceData)
  }, [surfaceTool, surfaceData, onSurfaceDataChange])

  const handleReshapeRoomCommit = useCallback((roomId, cells, cellMode) => {
    const result = paintRoomFootprintCells(surfaceData, roomId, cells, cellMode)
    if (result?.error) {
      onSurfaceToolChange?.({ ...surfaceTool, roomArcError: result.error })
      return
    }
    if (result?.surfaceData && result.surfaceData !== surfaceData) {
      onSurfaceDataChange(result.surfaceData)
    }
    if (surfaceTool?.roomArcError) onSurfaceToolChange?.({ ...surfaceTool, roomArcError: null })
  }, [surfaceData, surfaceTool, onSurfaceToolChange, onSurfaceDataChange])

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
      // Peinture de mur : entièrement gérée par ses propres meshes (PaintableRoomWalls) — jamais
      // par le système générique de glisser-déposer, qui retomberait sinon sur applyFloorSelection
      // (voxel) faute de branche dédiée en mouseup.
      if (mode === 'paint-wall') return
      const placesDoor = mode === 'connector' && surfaceTool?.connectorType === 'door'
      const start = placesDoor
        ? getSelectedDoorWallPoint(e.clientX, e.clientY)
        : mode === 'wall'
          ? getWallPoint(e.clientX, e.clientY)
          : getFloorCell(e.clientX, e.clientY)
      if (!start) {
        if (placesDoor) {
          e.preventDefault()
          e.stopPropagation()
        }
        return
      }

      let nextDrag = { mode, start, end: start }
      if (mode === 'reshape-room') {
        const selectedRoomId = surfaceTool?.selectedRoomId
        const selectedRoom = selectedRoomId ? normalizeSurfaceData(surfaceData).rooms?.[selectedRoomId] : null
        if (!selectedRoom) return
        const footprintKeys = new Set(getRoomFootprintCells(selectedRoom).map(cell => roomCellKey(cell.x, cell.z)))
        const cellMode = footprintKeys.has(roomCellKey(start.x, start.z)) ? 'remove' : 'add'
        nextDrag = { ...nextDrag, cellMode, roomId: selectedRoomId }
      }
      dragRef.current = nextDrag
      clearPendingDrag()
      setDrag(nextDrag)
      setHoverPreview(null)
      e.preventDefault()
    }

    const handleMouseMove = (e) => {
      if (!dragRef.current) {
        if (surfaceTool?.mode === 'connector') {
          const placesDoor = surfaceTool?.connectorType === 'door'
          const point = placesDoor
            ? getSelectedDoorWallPoint(e.clientX, e.clientY)
            : getFloorCell(e.clientX, e.clientY)
          setHoverPreview(prev => {
            if (!point) return prev ? null : prev
            const next = { mode: 'connector', start: point, end: point }
            const same = placesDoor
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
      const placesDoor = mode === 'connector' && surfaceTool?.connectorType === 'door'
      const end = placesDoor
        ? getSelectedDoorWallPoint(e.clientX, e.clientY)
        : mode === 'wall'
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
      const placesDoor = mode === 'connector' && surfaceTool?.connectorType === 'door'
      const end = placesDoor
        ? (getSelectedDoorWallPoint(e.clientX, e.clientY) || currentDrag.end)
        : mode === 'wall'
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
            onSurfaceRoomSelect?.(null)
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
              roomWallEdit: true,
              selectedRoomWallKeys: [],
              selectedRoomWallCount: 0,
              roomArcError: null,
            })
            onSurfaceRoomSelect?.(hits[0].id)
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
          onSurfaceRoomSelect?.(null)
        }
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (mode === 'room') {
        // Reste en mode « Salle » après une pose réussie, comme tous les autres outils de pose
        // (§12.9, PLAN_WORLD_BUILDER_REWORK.md) — poser plusieurs salles à la suite ne rouvre plus
        // le panneau de la précédente à chaque fois ; passer en mode Sélection pour l'éditer ensuite.
        const result = applyRoomSelectionWithResult(surfaceData, finalDrag, surfaceTool, activeMaterial, availableBlocks)
        if (result.surfaceData !== surfaceData) onSurfaceDataChange(result.surfaceData)
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
        if (nextData === surfaceData) {
          onSurfaceToolChange?.({
            ...surfaceTool,
            roomArcError: surfaceTool?.connectorType === 'door'
              ? t('surfaceEditor.connectorDoorWallError')
              : t('surfaceEditor.connectorPlacementError'),
          })
          e.preventDefault()
          e.stopPropagation()
          return
        }
        // Reste en mode « Connecteur » après une pose réussie, même règle que Salle ci-dessus
        // (§12.9) — poser plusieurs portes/ascenseurs/échelles à la suite ne redemande plus de
        // recliquer l'outil à chaque fois. `connectorWallEdgeKeys` (restreint la porte au mur
        // sélectionné via le panneau Mur, cf. connectors.js) est remis à vide après la pose : sans
        // ça, une 2e porte resterait invisiblement limitée au mur de la 1re alors que le geste
        // persiste maintenant — un risque qui n'existait pas quand le mode repassait en Sélection.
        onSurfaceDataChange(nextData)
        onSurfaceToolChange?.({ ...surfaceTool, roomArcError: null, connectorWallEdgeKeys: [] })
        setHoverPreview(null)
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (mode === 'reshape-room') {
        const { roomId, cellMode } = currentDrag
        const area = normalizeCellSelection(finalDrag)
        if (roomId && cellMode && area) {
          const cells = []
          for (let x = area.minX; x <= area.maxX; x += 1) {
            for (let z = area.minZ; z <= area.maxZ; z += 1) cells.push({ x, z })
          }
          handleReshapeRoomCommit(roomId, cells, cellMode)
        }
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (mode === 'wall-reshape') {
        // Seuil clic/glissé (§10c/§12.9) : sous le seuil, ne rien faire — pas de rangée fantôme sur
        // un simple re-clic du mur déjà sélectionné (wallRunRowCountForCell n'a jamais de valeur 0).
        const movedPx = Math.hypot(
          e.clientX - (currentDrag.startClientX || 0),
          e.clientY - (currentDrag.startClientY || 0),
        )
        if (movedPx >= WALL_RESHAPE_CLICK_THRESHOLD_PX && currentDrag.roomId && finalDrag.end) {
          const rowCount = wallRunRowCountForCell(currentDrag.wallRun, finalDrag.end)
          if (rowCount !== 0) {
            const cells = wallRunReshapeCells(currentDrag.wallRun, rowCount)
            handleReshapeRoomCommit(currentDrag.roomId, cells, rowCount > 0 ? 'add' : 'remove')
          }
        }
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
            puissance: Math.round(Number(surfaceTool?.effectPuissance) || 0),
            source: { kind: 'editor' },
          })
        }
        setHoverPreview(null)
        e.preventDefault()
        e.stopPropagation()
        return
      }

      const nextData = applyToolMode(mode, surfaceData, finalDrag, surfaceTool, activeMaterial, availableBlocks)
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
    getSelectedDoorWallPoint,
    getWallPoint,
    getWorldPoint,
    onSurfaceConnectorSelect,
    onSurfaceRoomSelect,
    onSurfaceDataChange,
    onSurfaceToolChange,
    handleReshapeRoomCommit,
    t,
  ])

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

  const gridElevation = getEditPlaneY(surfaceTool)
  // Grille visuelle — grandit avec le sol construit, jamais au-delà de GRID_SIZE (garde-fou de
  // construction inchangé, cf. clamps `Math.abs(x) > GRID_SIZE / 2` plus bas dans ce fichier).
  const visibleGridSize = useMemo(
    () => computeSurfaceGridExtent(surfaceData, { max: GRID_SIZE }),
    [surfaceData],
  )
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
      return roomSliceContours(room, displayLevel - baseLevel, surfaceData.rooms, STORY_HEIGHT).length > 0
    })
  const reshapeRoomPreviewCells = (() => {
    if (drag?.mode !== 'reshape-room') return []
    const area = normalizeCellSelection(drag)
    if (!area) return []
    const cells = []
    for (let x = area.minX; x <= area.maxX; x += 1) {
      for (let z = area.minZ; z <= area.maxZ; z += 1) cells.push({ x, z })
    }
    return cells
  })()
  // Poignée (§10c/§12.9) : même aperçu vert/rouge en direct que le geste « cases », construit à
  // partir du même rowCount qui sera commité au relâchement (aucun calcul dupliqué).
  const wallReshapePreviewMode = drag?.mode === 'wall-reshape' && drag.wallRun && drag.end
    ? wallRunRowCountForCell(drag.wallRun, drag.end)
    : 0
  const wallReshapePreviewCells = wallReshapePreviewMode !== 0
    ? wallRunReshapeCells(drag.wallRun, wallReshapePreviewMode)
    : []
  const connectorPreview = drag?.mode === 'connector'
    ? drag
    : surfaceTool?.mode === 'connector' && hoverPreview?.mode === 'connector'
      ? hoverPreview
      : null
  const placingDoorOnSelectedWall = surfaceTool?.mode === 'connector'
    && surfaceTool?.connectorType === 'door'
    && (surfaceTool?.connectorWallEdgeKeys || []).length > 0

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
        args={[visibleGridSize, visibleGridSize]}
        position={[0, gridElevation + 0.01, 0]}
        cellColor="#334155"
        sectionColor="#475569"
        fadeDistance={80}
      />
      <Grid
        args={[visibleGridSize, visibleGridSize * SURFACE_FINE]}
        position={[0, gridElevation + 0.02, 0]}
        cellColor="#233044"
        sectionColor="#233044"
        fadeDistance={45}
      />
      <SurfaceDungeonScene
        surfaceData={surfaceData}
        textureMaterials={textureMaterials}
        ceilingOpacity={0.35}
        displayLevel={displayLevel}
        cameraControlsRef={orbitRef}
        showDetails
        selectedConnectorId={selectedConnectorId || surfaceTool?.selectedConnectorId}
        onConnectorSelect={surfaceTool?.mode === 'select' ? handleConnectorPointerSelect : null}
        runtimeFeatureStates={runtimeFeatureStates}
        wallOcclusionEnabled={false}
      />
      <RuntimeEffectRegions regions={runtimeEffectRegions} surfaceData={surfaceData} displayLevel={displayLevel} />
      {selectedRooms.map(room => (
        <SelectedRoomOverlay
          key={room.id}
          room={room}
          roomLookup={surfaceData.rooms}
          displayLevel={displayLevel}
        />
      ))}
      {(surfaceTool?.mode === 'select' || placingDoorOnSelectedWall) && selectedRooms.length === 1 && (
        <>
          <RoomWallSelectionOverlay
            room={selectedRooms[0]}
            displayLevel={displayLevel}
            selectedKeys={surfaceTool?.selectedRoomWallKeys}
            onToggle={handleRoomWallPointerSelect}
            onReshapeStart={handleWallReshapeStart}
            interactive={surfaceTool?.mode === 'select'}
          />
          {surfaceTool?.mode === 'select' && (surfaceTool?.selectedRoomWallCount || 0) >= 2 && (
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
      {surfaceTool?.mode === 'paint-wall' && selectedRooms.map(paintableRoom => (
        <PaintableRoomWalls
          key={paintableRoom.id}
          room={paintableRoom}
          displayLevel={displayLevel}
          scope={surfaceTool?.wallPaintScope || 'case'}
          onPaint={handlePaintWallClick}
        />
      ))}
      {drag?.mode === 'reshape-room' && drag.roomId && (
        <RoomFootprintPaintPreview
          surfaceData={surfaceData}
          roomId={drag.roomId}
          cellMode={drag.cellMode}
          cells={reshapeRoomPreviewCells}
          displayLevel={displayLevel}
        />
      )}
      {drag?.mode === 'wall-reshape' && drag.roomId && wallReshapePreviewCells.length > 0 && (
        <RoomFootprintPaintPreview
          surfaceData={surfaceData}
          roomId={drag.roomId}
          cellMode={wallReshapePreviewMode > 0 ? 'add' : 'remove'}
          cells={wallReshapePreviewCells}
          displayLevel={displayLevel}
        />
      )}
      {drag?.mode === 'wall' ? (
        <WallPreview drag={drag} surfaceTool={surfaceTool} activeMaterial={activeMaterial} availableBlocks={availableBlocks} />
      ) : drag?.mode === 'stair' ? (
        <StairPreview drag={drag} surfaceTool={surfaceTool} activeMaterial={activeMaterial} availableBlocks={availableBlocks} />
      ) : drag?.mode === 'effect' ? (
        <EffectVolumePreview selection={drag} surfaceTool={surfaceTool} />
      ) : drag?.mode === 'room' ? (
        <RoomPreview selection={drag} surfaceTool={surfaceTool} />
      ) : drag?.mode === 'select' ? (
        <SelectionPreview selection={drag} surfaceTool={surfaceTool} />
      ) : drag?.mode === 'reshape-room' ? (
        null
      ) : drag?.mode === 'wall-reshape' ? (
        null
      ) : drag?.mode === 'connector' ? (
        // Aperçu propre à ConnectorPreview (ci-dessous) — éviter que le repli générique
        // FloorPreview se superpose au vrai modèle pendant un glissé de connecteur (bug trouvé
        // au §11 de PLAN_WORLD_BUILDER_REWORK.md).
        null
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
