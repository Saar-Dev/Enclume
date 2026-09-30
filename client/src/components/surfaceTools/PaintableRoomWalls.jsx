import { useState } from 'react'
import { Line } from '@react-three/drei'
import { STORY_HEIGHT, SURFACE_FINE, levelToY } from '../../lib/surfaceCore.js'
import { roomWallEdgeKeyAtPoint } from '../../lib/surfaceRooms.js'
import { getWallRenderBox } from '../../lib/surfaceGeometry.js'
import { roomSelectableWallRuns } from '../../../../shared/world/roomGeometry.js'

// Extrait de SurfaceEditorScene.jsx (§11.13, PLAN_WORLD_BUILDER_REWORK.md). L'outil Peindre un mur
// sort déjà du système générique de glisser-déposer (§11.9) — ces meshes cliquables sont son seul
// mécanisme d'interaction, propre à lui.
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

export default function PaintableRoomWalls({ room, displayLevel, scope, onPaint }) {
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
