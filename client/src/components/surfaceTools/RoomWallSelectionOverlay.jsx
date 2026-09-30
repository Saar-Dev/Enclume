import { useState } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { STORY_HEIGHT, SURFACE_FINE, levelToY } from '../../lib/surfaceCore.js'
import { getWallRenderBox } from '../../lib/surfaceGeometry.js'
import { roomSelectableWallRuns } from '../../../../shared/world/roomGeometry.js'

// Murs sélectionnables d'une salle + poignée de redimensionnement (§10c) — extrait de
// SurfaceEditorScene.jsx (§11.14, PLAN_WORLD_BUILDER_REWORK.md).
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

export default function RoomWallSelectionOverlay({ room, displayLevel, selectedKeys, onToggle, onReshapeStart, interactive = true }) {
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
