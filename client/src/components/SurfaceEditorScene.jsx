import { useCallback, useEffect, useRef, useState } from 'react'
import { Grid, MapControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import SurfaceDungeonScene from './SurfaceDungeonScene.jsx'
import {
  SURFACE_FINE,
  applyCeilingSelection,
  applyFloorSelection,
  applyStairSelection,
  applyWallDrag,
  eraseSurfaceSelection,
  getToolCeilingHeight,
  getToolCeilingThickness,
  getToolElevation,
  getToolFloorThickness,
  getToolWallThicknessFine,
  getWallRenderBox,
  makeStairFromSelection,
  makeWallsFromDrag,
  normalizeSurfaceData,
  parseFloorKey,
  normalizeCellSelection,
  stairStepBoxes,
} from '../lib/surfaceData.js'

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

function WallPreview({ drag, surfaceTool, activeMaterial, availableBlocks }) {
  const walls = makeWallsFromDrag(drag?.start, drag?.end, surfaceTool, activeMaterial, availableBlocks)
  if (!walls?.length) return null

  return (
    <>
      {walls.map(wall => {
        const box = getWallRenderBox(wall)
        if (!box) return null
        return (
          <mesh key={wall.id} position={box.position}>
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

export default function SurfaceEditorScene({
  surfaceData,
  onSurfaceDataChange,
  textureMaterials,
  activeMaterial,
  surfaceTool,
  availableBlocks,
}) {
  const { camera, gl } = useThree()
  const orbitRef = useRef()
  const raycaster = useRef(new THREE.Raycaster())
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const dragRef = useRef(null)
  const [drag, setDrag] = useState(null)

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

  const getFinePoint = useCallback((clientX, clientY) => {
    const point = getWorldPoint(clientX, clientY)
    if (!point) return null
    const fx = Math.round(point.x * SURFACE_FINE)
    const fz = Math.round(point.z * SURFACE_FINE)
    if (Math.abs(fx / SURFACE_FINE) > GRID_SIZE / 2 || Math.abs(fz / SURFACE_FINE) > GRID_SIZE / 2) return null
    return { fx, fz }
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

    for (const [id, floor] of Object.entries(surface.floors)) {
      const parsed = parseFloorKey(id, floor)
      if (!sameLevel(parsed.y, level)) continue

      const edges = [
        { line: 'z', value: parsed.z, min: parsed.x, max: parsed.x + 1, distance: Math.abs(point.z - parsed.z), along: point.x },
        { line: 'z', value: parsed.z + 1, min: parsed.x, max: parsed.x + 1, distance: Math.abs(point.z - (parsed.z + 1)), along: point.x },
        { line: 'x', value: parsed.x, min: parsed.z, max: parsed.z + 1, distance: Math.abs(point.x - parsed.x), along: point.z },
        { line: 'x', value: parsed.x + 1, min: parsed.z, max: parsed.z + 1, distance: Math.abs(point.x - (parsed.x + 1)), along: point.z },
      ]

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

    if (best) return { fx: best.fx, fz: best.fz, sticky: true }

    const fx = Math.round(point.x * SURFACE_FINE)
    const fz = Math.round(point.z * SURFACE_FINE)
    return { fx, fz }
  }, [getWorldPoint, surfaceData, surfaceTool])

  useEffect(() => {
    const canvas = gl.domElement
    const preventContextMenu = (e) => e.preventDefault()

    const cancelDrag = (e) => {
      if (!dragRef.current) return false
      dragRef.current = null
      setDrag(null)
      e.preventDefault()
      e.stopPropagation()
      return true
    }

    const handleMouseDown = (e) => {
      if (e.button === 2 && cancelDrag(e)) return
      if (e.button !== 0) return
      const mode = surfaceTool?.mode || 'floor'
      const start = mode === 'wall'
        ? getWallPoint(e.clientX, e.clientY)
        : getFloorCell(e.clientX, e.clientY)
      if (!start) return

      const nextDrag = { mode, start, end: start }
      dragRef.current = nextDrag
      setDrag(nextDrag)
      e.preventDefault()
    }

    const handleMouseMove = (e) => {
      if (!dragRef.current) return
      if ((e.buttons & 2) !== 0 && cancelDrag(e)) return
      const mode = dragRef.current.mode
      const end = mode === 'wall'
        ? getWallPoint(e.clientX, e.clientY)
        : getFloorCell(e.clientX, e.clientY)
      if (!end) return

      const nextDrag = { ...dragRef.current, end }
      dragRef.current = nextDrag
      setDrag(nextDrag)
    }

    const handleMouseUp = (e) => {
      if (e.button !== 0) return
      const currentDrag = dragRef.current
      if (!currentDrag) return

      const mode = currentDrag.mode
      const end = mode === 'wall'
        ? (getWallPoint(e.clientX, e.clientY) || currentDrag.end)
        : (getFloorCell(e.clientX, e.clientY) || currentDrag.end)
      const finalDrag = { ...currentDrag, end }
      dragRef.current = null
      setDrag(null)

      const nextData = mode === 'wall'
        ? applyWallDrag(surfaceData, finalDrag.start, finalDrag.end, surfaceTool, activeMaterial, availableBlocks)
        : mode === 'stair'
          ? applyStairSelection(surfaceData, finalDrag, surfaceTool, activeMaterial, availableBlocks)
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
    getFloorCell,
    getWallPoint,
    onSurfaceDataChange,
  ])

  useEffect(() => {
    if (!orbitRef.current) return
    orbitRef.current.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    }
  }, [])

  const gridElevation = getEditPlaneY(surfaceTool)

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
      />
      {drag?.mode === 'wall' ? (
        <WallPreview drag={drag} surfaceTool={surfaceTool} activeMaterial={activeMaterial} availableBlocks={availableBlocks} />
      ) : drag?.mode === 'stair' ? (
        <StairPreview drag={drag} surfaceTool={surfaceTool} activeMaterial={activeMaterial} availableBlocks={availableBlocks} />
      ) : drag?.mode === 'ceiling' ? (
        <CeilingPreview selection={drag} surfaceTool={surfaceTool} />
      ) : (
        <FloorPreview selection={drag} surfaceTool={surfaceTool} />
      )}
    </>
  )
}
