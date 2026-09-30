import { useEffect, useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { STORY_HEIGHT, getRoomBaseY, levelToY, yToLevel } from '../../lib/surfaceCore.js'
import { roomBoundaryContours, roomSliceContours } from '../../../../shared/world/roomGeometry.js'

// Contour + remplissage jaune de la salle sélectionnée en mode Sélection — extrait de
// SurfaceEditorScene.jsx (§11.14, PLAN_WORLD_BUILDER_REWORK.md).
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

export default function SelectedRoomOverlay({ room, roomLookup, displayLevel }) {
  if (!room) return null
  const y = levelToY(displayLevel) + 0.08

  return (
    <group renderOrder={30}>
      <RoomSelectionShape room={room} roomLookup={roomLookup} y={y} displayLevel={displayLevel} />
      <RoomSelectionContour room={room} roomLookup={roomLookup} y={y + 0.025} displayLevel={displayLevel} />
    </group>
  )
}
