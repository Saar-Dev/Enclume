import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { createWaterMaterial, updateWaterMaterial } from '../lib/waterMaterials'
import ReliefBoxGeometry from './ReliefBoxGeometry.jsx'
import StairPrismGeometry from './StairPrismGeometry.jsx'
import {
  generateProceduralMaterialTexture,
  proceduralPatternUsesCutout,
} from '../lib/proceduralMaterials.js'
import { applyMaterialSlotOverrides, connectorModelMaterialSlots, normalizeModelMaterialSlots } from '../lib/modelMaterialSlots.js'
import { arcSurfaceMountFrame } from '../lib/curvedConnectorMount.js'
import {
  cameraFacingFacadeIds,
  cameraRoomIdForDisplayLevel,
  cameraRoomContextId,
  wallFacadeKey,
  wallParticipatesInCameraCutaway,
} from '../lib/cameraCutaway.js'
import {
  attachEntitySelectionHalo,
  disposeEntitySelectionHalo,
  setEntitySelectionHaloVisible,
} from '../lib/entitySelectionHalo.js'
import {
  horizontalInterfaceOpacity,
  horizontalInterfaceRenderKind,
  horizontalSurfaceY,
} from '../lib/horizontalSurfaceOpacity.js'
import { useModelStateAnimation } from '../lib/useModelStateAnimation.js'
import {
  differenceMultiPolygons,
  multiPolygonContours,
  intersectMultiPolygons,
  roomBoundaryMultiPolygon,
  roomBoundaryContours,
  roomHorizontalInterfaces,
  roomInteriorFootprintAtY,
  roomSliceAtLevel,
  sampleWallArcGeometry,
  wallCornerIntersectionPoint,
} from '../../../shared/world/roomGeometry.js'
import {
  stairGeometry,
  stairOpeningMultiPolygon,
} from '../../../shared/world/stairGeometry.js'
import {
  SURFACE_FINE,
  STORY_HEIGHT,
  computeSurfaceWaterCells,
  getCeilingThickness,
  getFloorThickness,
  getRoomBaseY,
  getRoomCeilingThickness,
  getRoomFloorThickness,
  getRoomTopY,
  getWallRenderBox,
  hatchOrientationQuarterTurns,
  isWorldInteriorPointVisibleAtLevel,
  isWorldPointVisibleAtLevel,
  normalizeSurfaceData,
  parseCeilingKey,
  parseFloorKey,
  roomFootprintRectangles,
  roomsWallRenderPaths,
  wallOpeningVerticalRange,
  wallProfileVerticalProgresses,
  yToLevel,
} from '../lib/surfaceData.js'

const FACE = {
  east: 0,
  west: 1,
  top: 2,
  bottom: 3,
  south: 4,
  north: 5,
}

const proceduralSurfaceMaterialCache = new Map()
const proceduralPreviewMaterialCache = new Map()
const opacityMaterialCache = new WeakMap()
const repeatMaterialCache = new WeakMap()
// Drei/Grid dessine les grandes cases avec sectionSize=1.
// Côté règles Enclume, cette case vaut 1,5 m, mais côté rendu elle vaut
// toujours 1 unité Three.js. Les UV doivent donc suivre l'unité visible,
// pas multiplier par 1,5.
const GRID_SECTION_WORLD_UNITS = 1
const GRID_SECTION_METERS = 1.5
const TEXTURE_TILE_GRID_SECTIONS = 1
const GRATE_VISUAL_THICKNESS = 0.045
const STAIR_GRATE_TEXTURE_REPEAT = 2
const RELIEF_SEGMENTS_PER_TEXTURE_TILE = 14
const RELIEF_MAX_SEGMENTS = 192
const BOLT_HEAD_RADIUS = 0.026
const BOLT_HEAD_HEIGHT = 0.012
const BOLT_WASHER_RADIUS = 0.034
const BOLT_WASHER_HEIGHT = 0.004
const BOLT_EDGE_OFFSET = 0.14
const BOLT_WALL_VERTICAL_OFFSET = 0.22
const BOLT_FACE_GAP = 0.006
const BOLT_HEAD_SEGMENTS = 6
const BOLT_WASHER_SEGMENTS = 24
const DOOR_FRAME_WALL_OVERLAP = 0.01
const OCCLUDED_WALL_OPACITY = 0.18
const BOLT_HEAD_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#b4bec2',
  roughness: 0.52,
  metalness: 0.45,
})
const BOLT_WASHER_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#333a3e',
  roughness: 0.68,
  metalness: 0.3,
})
const HIDDEN_WALL_CAP_MATERIAL = new THREE.MeshBasicMaterial({ visible: false })
const STRUCTURAL_STEEL_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#6f7f86',
  roughness: 0.5,
  metalness: 0.68,
})

function useCameraRoomId(surface, displayLevel, cameraControlsRef = null, roomContextAnchor = null) {
  const { camera } = useThree()
  const [roomContext, setRoomContext] = useState({ displayLevel: null, roomId: null })
  const roomId = cameraRoomIdForDisplayLevel(roomContext, displayLevel)
  const elapsedRef = useRef(0)
  const lastCameraRef = useRef(null)

  useFrame((_, delta) => {
    if (displayLevel === null || displayLevel === undefined) {
      if (roomContext.roomId !== null || roomContext.displayLevel !== null) {
        setRoomContext({ displayLevel: null, roomId: null })
      }
      return
    }
    elapsedRef.current += delta
    if (elapsedRef.current < 0.12) return
    elapsedRef.current = 0

    const hasAuthoritativeAnchor = roomContextAnchor
      && [roomContextAnchor.x, roomContextAnchor.y, roomContextAnchor.z].every(value => Number.isFinite(Number(value)))
    const controlsTarget = cameraControlsRef?.current?.target
    const hasControlsTarget = controlsTarget
      && [controlsTarget.x, controlsTarget.y, controlsTarget.z].every(Number.isFinite)
    const focus = hasAuthoritativeAnchor
      ? new THREE.Vector3(Number(roomContextAnchor.x), Number(roomContextAnchor.y), Number(roomContextAnchor.z))
      : hasControlsTarget
        ? controlsTarget.clone()
      : (() => {
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize()
        const planeY = Number(displayLevel) * STORY_HEIGHT + 0.04
        const distanceToPlane = Math.abs(direction.y) > 1e-5
          ? (planeY - camera.position.y) / direction.y
          : -1
        return distanceToPlane >= 0
          ? camera.position.clone().addScaledVector(direction, distanceToPlane)
          : camera.position.clone().addScaledVector(direction, 4)
      })()
    const previous = lastCameraRef.current
    const cameraContextIsStable = hasAuthoritativeAnchor || hasControlsTarget || (
      previous && previous.cameraPosition.distanceToSquared(camera.position) < 0.0009
    )
    if (previous
      && previous.displayLevel === displayLevel
      && previous.focus.distanceToSquared(focus) < 0.0009
      && cameraContextIsStable
      && previous.usesAuthoritativeAnchor === Boolean(hasAuthoritativeAnchor)
      && previous.usesControlsTarget === Boolean(hasControlsTarget)
      && previous.rooms === surface.rooms) return
    lastCameraRef.current = {
      displayLevel,
      focus,
      cameraPosition: camera.position.clone(),
      usesAuthoritativeAnchor: Boolean(hasAuthoritativeAnchor),
      usesControlsTarget: Boolean(hasControlsTarget),
      rooms: surface.rooms,
    }

    const nextRoomId = cameraRoomContextId({
      rooms: surface.rooms,
      displayLevel,
      camera: hasAuthoritativeAnchor ? null : camera.position,
      focus,
      storyHeight: STORY_HEIGHT,
    })
    const normalizedDisplayLevel = Number(displayLevel)
    if (nextRoomId !== roomId || roomContext.displayLevel !== normalizedDisplayLevel) {
      setRoomContext({ displayLevel: normalizedDisplayLevel, roomId: nextRoomId })
    }
  })

  return roomId
}

function proceduralMaterialKey(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') return null
  return JSON.stringify({
    type: descriptor.type,
    version: descriptor.version,
    material: descriptor.material,
    paint: descriptor.paint,
    pattern: descriptor.pattern,
    wear: descriptor.wear,
    dirt: descriptor.dirt,
    relief: descriptor.relief,
    realRelief: descriptor.realRelief,
    seed: descriptor.seed,
  })
}

function makeDataTexture(dataUrl, color = true, smooth = false) {
  const texture = new THREE.TextureLoader().load(dataUrl)
  texture.colorSpace = color ? THREE.SRGBColorSpace : (THREE.NoColorSpace || '')
  texture.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter
  texture.minFilter = smooth ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

function pbrForProcedural(materialId, patternId = null) {
  if (proceduralPatternUsesCutout(patternId)) return { roughness: 0.48, metalness: 0.72 }
  switch (materialId) {
    case 'steel':
      return { roughness: 0.55, metalness: 0.42 }
    case 'plastic':
      return { roughness: 0.62, metalness: 0.02 }
    case 'wood':
      return { roughness: 0.78, metalness: 0.02 }
    case 'concrete':
      return { roughness: 0.88, metalness: 0.01 }
    default:
      return { roughness: 0.72, metalness: 0.08 }
  }
}

function proceduralMaterialAt(descriptor) {
  const key = proceduralMaterialKey(descriptor)
  if (!key) return null
  if (proceduralSurfaceMaterialCache.has(key)) return proceduralSurfaceMaterialCache.get(key)

  const cutout = proceduralPatternUsesCutout(descriptor.pattern)
  const generated = generateProceduralMaterialTexture({ ...descriptor, size: cutout ? 256 : 128 })
  const map = makeDataTexture(generated.albedoDataUrl, true, cutout)
  const normalMap = makeDataTexture(generated.normalDataUrl, false, cutout)
  const pbr = pbrForProcedural(generated.material?.id, descriptor.pattern)
  const reliefStrength = Math.max(0, Math.min(1, Number(descriptor.relief) / 100 || 0))
  const material = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.8 + reliefStrength * 0.7, 0.8 + reliefStrength * 0.7),
    color: 0xffffff,
    roughness: pbr.roughness,
    metalness: pbr.metalness,
    alphaTest: cutout ? Number(descriptor.alphaCutoff) || 0.5 : 0,
    side: cutout ? THREE.DoubleSide : THREE.FrontSide,
  })
  const solidMaterial = cutout
    ? new THREE.MeshStandardMaterial({
        color: descriptor.paint || '#6f7f8e',
        roughness: 0.5,
        metalness: 0.68,
      })
    : material
  const entry = {
    faceMaterials: [material, material, material, material, material, material],
    relief: cutout ? null : generated.procedural,
    cutout,
    cutoutMaterial: material,
    solidMaterial,
  }
  proceduralSurfaceMaterialCache.set(key, entry)
  return entry
}

function proceduralPreviewMaterialAt(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') return null
  const key = JSON.stringify({
    material: descriptor.material,
    paint: descriptor.paint,
    pattern: descriptor.pattern,
  })
  if (proceduralPreviewMaterialCache.has(key)) return proceduralPreviewMaterialCache.get(key)

  const pbr = pbrForProcedural(descriptor.material)
  const material = new THREE.MeshStandardMaterial({
    color: descriptor.paint || '#6f7f8e',
    roughness: pbr.roughness,
    metalness: pbr.metalness,
  })
  const entry = {
    faceMaterials: [material, material, material, material, material, material],
    relief: null,
  }
  proceduralPreviewMaterialCache.set(key, entry)
  return entry
}

function surfaceMaterialAt(descriptor, showDetails) {
  if (proceduralPatternUsesCutout(descriptor?.pattern)) return proceduralMaterialAt(descriptor)
  return showDetails
    ? proceduralMaterialAt(descriptor)
    : proceduralPreviewMaterialAt(descriptor)
}

function materialAt(textureMaterials, texId, face, fallbackFace = FACE.top) {
  return textureMaterials[texId]?.faceMaterials[face]
    || textureMaterials[texId]?.faceMaterials[fallbackFace]
    || null
}

function reliefAt(textureMaterials, texId) {
  return textureMaterials[texId]?.relief || null
}

function solidMaterialAt(textureMaterials, texId) {
  return textureMaterials[texId]?.solidMaterial || null
}

function usesCutoutMaterial(procedural, textureMaterials, texId) {
  return Boolean(procedural?.cutout || textureMaterials[texId]?.cutout)
}

function thinGrateThickness(physicalThickness, cutout) {
  const thickness = Math.max(0.01, Number(physicalThickness) || 0.01)
  return cutout ? Math.min(thickness, GRATE_VISUAL_THICKNESS) : thickness
}

function horizontalSurfaceVisualY(y, physicalThickness, visualThickness, face) {
  if (visualThickness >= physicalThickness - 1e-6) return y
  const direction = face === 'bottom' ? -1 : 1
  return y + direction * (physicalThickness - visualThickness) / 2
}

function withOpacity(materials, opacity) {
  if (opacity >= 0.999) return materials
  return materials.map((material) => {
    let variants = opacityMaterialCache.get(material)
    if (!variants) {
      variants = new Map()
      opacityMaterialCache.set(material, variants)
    }
    const key = Math.round(opacity * 1000)
    if (variants.has(key)) return variants.get(key)
    const clone = material.clone()
    clone.transparent = true
    clone.opacity = opacity
    clone.depthWrite = false
    variants.set(key, clone)
    return clone
  })
}

function withRepeat(material, repeatX = 1, repeatY = 1, offsetX = 0, offsetY = 0) {
  if (!material) return material
  const normalizeRepeat = (value) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return 1
    const rounded = Math.round(n * 1000) / 1000
    if (Math.abs(rounded) < 0.05) return rounded < 0 ? -0.05 : 0.05
    return rounded
  }
  const safeX = normalizeRepeat(repeatX)
  const safeY = normalizeRepeat(repeatY)
  const safeOffsetX = Math.round((Number(offsetX) || 0) * 1000) / 1000
  const safeOffsetY = Math.round((Number(offsetY) || 0) * 1000) / 1000
  const key = `${safeX}:${safeY}:${safeOffsetX}:${safeOffsetY}`
  let variants = repeatMaterialCache.get(material)
  if (!variants) {
    variants = new Map()
    repeatMaterialCache.set(material, variants)
  }
  if (variants.has(key)) return variants.get(key)

  const clone = material.clone()
  for (const mapName of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
    if (!clone[mapName]) continue
    clone[mapName] = clone[mapName].clone()
    clone[mapName].repeat.set(safeX, safeY)
    clone[mapName].offset.set(safeOffsetX, safeOffsetY)
    clone[mapName].needsUpdate = true
  }
  variants.set(key, clone)
  return clone
}

function repeatForGridSections(lengthWorldUnits) {
  return Math.max(
    0.05,
    (Number(lengthWorldUnits) || 1) / (GRID_SECTION_WORLD_UNITS * TEXTURE_TILE_GRID_SECTIONS),
  )
}

function uvCoordForGridSections(positionWorldUnits) {
  return (Number(positionWorldUnits) || 0) / (GRID_SECTION_WORLD_UNITS * TEXTURE_TILE_GRID_SECTIONS)
}

function floorRepeat(length) {
  return repeatForGridSections(length)
}

function heightRepeat(length) {
  return repeatForGridSections(length)
}

function reliefMaxSegmentsForRepeats(...values) {
  const maxRepeat = Math.max(1, ...values.map(value => Math.abs(Number(value) || 1)))
  return Math.max(32, Math.min(RELIEF_MAX_SEGMENTS, Math.ceil(maxRepeat * RELIEF_SEGMENTS_PER_TEXTURE_TILE)))
}

function faceUvTransformsForBox(minX, minY, minZ, maxX, maxY, maxZ) {
  const width = maxX - minX
  const height = maxY - minY
  const depth = maxZ - minZ
  return [
    { scale: [-floorRepeat(depth), heightRepeat(height)], offset: [uvCoordForGridSections(maxZ), uvCoordForGridSections(minY)] },
    { scale: [floorRepeat(depth), heightRepeat(height)], offset: [uvCoordForGridSections(minZ), uvCoordForGridSections(minY)] },
    { scale: [floorRepeat(width), -floorRepeat(depth)], offset: [uvCoordForGridSections(minX), uvCoordForGridSections(maxZ)] },
    { scale: [floorRepeat(width), floorRepeat(depth)], offset: [uvCoordForGridSections(minX), uvCoordForGridSections(minZ)] },
    { scale: [floorRepeat(width), heightRepeat(height)], offset: [uvCoordForGridSections(minX), uvCoordForGridSections(minY)] },
    { scale: [-floorRepeat(width), heightRepeat(height)], offset: [uvCoordForGridSections(maxX), uvCoordForGridSections(minY)] },
  ]
}

function faceUvScalesFromTransforms(transforms) {
  return transforms.map(transform => transform.scale)
}

function faceUvOffsetsFromTransforms(transforms) {
  return transforms.map(transform => transform.offset)
}

function withUvTransform(material, transform) {
  return withRepeat(material, transform.scale[0], transform.scale[1], transform.offset[0], transform.offset[1])
}

function usesBoltHeads(descriptor) {
  return descriptor?.type === 'procedural-material' && descriptor.pattern === 'metal_panels'
}

function pairOffsets(size, margin) {
  if (size <= margin * 2.4) return [0]
  return [-size / 2 + margin, size / 2 - margin]
}

function BoltHead({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh
        position={[0, BOLT_FACE_GAP + BOLT_WASHER_HEIGHT / 2, 0]}
        material={BOLT_WASHER_MATERIAL}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[BOLT_WASHER_RADIUS, BOLT_WASHER_RADIUS, BOLT_WASHER_HEIGHT, BOLT_WASHER_SEGMENTS]} />
      </mesh>
      <mesh
        position={[0, BOLT_FACE_GAP + BOLT_WASHER_HEIGHT + BOLT_HEAD_HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 6, 0]}
        material={BOLT_HEAD_MATERIAL}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[BOLT_HEAD_RADIUS, BOLT_HEAD_RADIUS, BOLT_HEAD_HEIGHT, BOLT_HEAD_SEGMENTS]} />
      </mesh>
    </group>
  )
}

function TopBoltHeads({ id, descriptor, x, z, topY }) {
  if (!usesBoltHeads(descriptor)) return null

  const margin = BOLT_EDGE_OFFSET
  const points = [
    [x + margin, z + margin],
    [x + 1 - margin, z + margin],
    [x + margin, z + 1 - margin],
    [x + 1 - margin, z + 1 - margin],
  ]
  return (
    <>
      {points.map(([px, pz], index) => (
        <BoltHead key={`${id}:bolt:${index}`} position={[px, topY, pz]} />
      ))}
    </>
  )
}

function WallBoltHeads({ wall, box, frontDescriptor, backDescriptor }) {
  if (!box || wall.axis === 'segment') return null

  const heads = []
  const [width, height, depth] = box.args
  const [cx, cy, cz] = box.position
  const yOffsets = pairOffsets(height, BOLT_WALL_VERTICAL_OFFSET)

  const addHead = (key, position, rotation) => {
    heads.push(<BoltHead key={key} position={position} rotation={rotation} />)
  }

  if (wall.axis === 'x' || wall.axis === 'segment') {
    const xOffsets = pairOffsets(width, BOLT_EDGE_OFFSET)
    if (usesBoltHeads(frontDescriptor)) {
      for (const lx of xOffsets) {
        for (const ly of yOffsets) {
          addHead(`front:${lx}:${ly}`, [cx + lx, cy + ly, cz + depth / 2], [Math.PI / 2, 0, 0])
        }
      }
    }
    if (usesBoltHeads(backDescriptor)) {
      for (const lx of xOffsets) {
        for (const ly of yOffsets) {
          addHead(`back:${lx}:${ly}`, [cx + lx, cy + ly, cz - depth / 2], [-Math.PI / 2, 0, 0])
        }
      }
    }
  } else {
    const zOffsets = pairOffsets(depth, BOLT_EDGE_OFFSET)
    if (usesBoltHeads(frontDescriptor)) {
      for (const lz of zOffsets) {
        for (const ly of yOffsets) {
          addHead(`front:${lz}:${ly}`, [cx + width / 2, cy + ly, cz + lz], [0, 0, -Math.PI / 2])
        }
      }
    }
    if (usesBoltHeads(backDescriptor)) {
      for (const lz of zOffsets) {
        for (const ly of yOffsets) {
          addHead(`back:${lz}:${ly}`, [cx - width / 2, cy + ly, cz + lz], [0, 0, Math.PI / 2])
        }
      }
    }
  }

  return heads.length ? <>{heads}</> : null
}

function FloorTile({ id, floor, surface, textureMaterials, opacity = 1, showDetails = true }) {
  const { x, z, y } = parseFloorKey(id, floor)
  const topProcedural = surfaceMaterialAt(floor.topMaterial || floor.material, showDetails)
  const bottomProcedural = surfaceMaterialAt(floor.bottomMaterial || floor.material, showDetails)
  const topTex = floor.topTex || floor.tex
  const bottomTex = floor.bottomTex || floor.tex || topTex
  const top = topProcedural?.faceMaterials[FACE.top] || materialAt(textureMaterials, topTex, FACE.top)
  const side = topProcedural?.solidMaterial || solidMaterialAt(textureMaterials, topTex) || topProcedural?.faceMaterials[FACE.south] || materialAt(textureMaterials, topTex, FACE.south, FACE.top) || top
  const bottom = bottomProcedural?.faceMaterials[FACE.bottom]
    || materialAt(textureMaterials, bottomTex, FACE.bottom, FACE.top)
    || top
  const topRelief = showDetails ? (topProcedural?.relief || reliefAt(textureMaterials, topTex)) : null
  const thickness = getFloorThickness(floor)
  const topCutout = usesCutoutMaterial(topProcedural, textureMaterials, topTex)
  const cutout = topCutout || usesCutoutMaterial(bottomProcedural, textureMaterials, bottomTex)
  const visualThickness = thinGrateThickness(thickness, cutout)
  const visualY = horizontalSurfaceVisualY(y, thickness, visualThickness, topCutout ? 'top' : 'bottom')
  const materials = top ? withOpacity([side, side, top, bottom, side, side], opacity) : []
  const clippedFootprint = (() => {
    const rawRoom = floor?.clipRoomId ? surface?.rooms?.[floor.clipRoomId] : null
    if (!rawRoom) return null
    const room = { id: floor.clipRoomId, ...rawRoom }
    const roomInterior = roomInteriorFootprintAtY(room, y, surface.rooms, STORY_HEIGHT)
    const tile = [[[[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1], [x, z]]]]
    return intersectMultiPolygons(tile, roomInterior)
  })()
  if (!top) return null
  if (clippedFootprint) {
    if (clippedFootprint.length === 0) return null
    return (
      <CurvedRoomSlab
        room={null}
        roomLookup={surface?.rooms}
        contours={multiPolygonContours(clippedFootprint)}
        kind="floor"
        y={visualY}
        thickness={visualThickness}
        capMaterial={top}
        sideMaterial={side}
        opacity={opacity}
      />
    )
  }
  return (
    <>
      <mesh
        position={[x + 0.5, visualY, z + 0.5]}
        material={materials}
        castShadow
        receiveShadow
        userData={{ worldSupport: true }}
      >
        <ReliefBoxGeometry
          args={[1, visualThickness, 1]}
          faceProfiles={[null, null, topRelief, null, null, null]}
          faceMask={[false, false, true, false, false, false]}
        />
      </mesh>
      {showDetails && (
        <TopBoltHeads id={`floor:${id}`} descriptor={floor.topMaterial || floor.material || topRelief} x={x} z={z} topY={y + thickness / 2} />
      )}
    </>
  )
}

function CeilingTile({ id, ceiling, textureMaterials, opacity, showDetails = true }) {
  const { x, z, y } = parseCeilingKey(id, ceiling)
  const topProcedural = surfaceMaterialAt(ceiling.topMaterial || ceiling.material, showDetails)
  const bottomProcedural = surfaceMaterialAt(ceiling.bottomMaterial || ceiling.material, showDetails)
  const topTex = ceiling.topTex || ceiling.tex
  const bottomTex = ceiling.bottomTex || ceiling.tex || topTex
  const bottom = bottomProcedural?.faceMaterials[FACE.bottom] || materialAt(textureMaterials, bottomTex, FACE.bottom, FACE.top)
    || materialAt(textureMaterials, ceiling.tex, FACE.top)
  if (!bottom) return null

  const top = topProcedural?.faceMaterials[FACE.top] || materialAt(textureMaterials, topTex, FACE.top, FACE.bottom) || bottom
  const side = topProcedural?.solidMaterial || solidMaterialAt(textureMaterials, topTex) || topProcedural?.faceMaterials[FACE.south] || materialAt(textureMaterials, topTex, FACE.south, FACE.top) || bottom
  const relief = showDetails ? (bottomProcedural?.relief || reliefAt(textureMaterials, bottomTex)) : null
  const thickness = getCeilingThickness(ceiling)
  const bottomCutout = usesCutoutMaterial(bottomProcedural, textureMaterials, bottomTex)
  const cutout = bottomCutout || usesCutoutMaterial(topProcedural, textureMaterials, topTex)
  const visualThickness = thinGrateThickness(thickness, cutout)
  const visualY = horizontalSurfaceVisualY(y, thickness, visualThickness, bottomCutout ? 'bottom' : 'top')
  const materials = withOpacity([side, side, top, bottom, side, side], opacity)
  return (
    <mesh position={[x + 0.5, visualY, z + 0.5]} material={materials} castShadow receiveShadow>
      <ReliefBoxGeometry
        args={[1, visualThickness, 1]}
        faceProfiles={[null, null, null, relief, null, null]}
        faceMask={[false, false, false, true, false, false]}
      />
    </mesh>
  )
}

function RoomSlab({
  room,
  roomLookup,
  kind,
  textureMaterials,
  opacity = 1,
  showDetails = true,
  footprintContours = null,
  footprint = null,
  yOverride = null,
  skylights = [],
  hatches = [],
  stairs = [],
}) {
  const sourceRectangles = roomFootprintRectangles(room)
  const isCeiling = kind === 'ceiling'
  const y = horizontalSurfaceY({
    yOverride,
    kind,
    roomBaseY: getRoomBaseY(room),
    roomTopY: getRoomTopY(room),
  })
  const thickness = isCeiling ? getRoomCeilingThickness(room) : getRoomFloorThickness(room)
  const slabSkylights = skylights.filter(connector => (
    Math.abs(Number(connector.y) - y) < 0.01
      && sourceRectangles.some(rectangle => (
        Number(connector.x) < rectangle.minX + rectangle.width
          && Number(connector.x) + Number(connector.width || 1) > rectangle.minX
          && Number(connector.z) < rectangle.minZ + rectangle.depth
          && Number(connector.z) + Number(connector.depth || 1) > rectangle.minZ
      ))
  ))
  const slabHatches = hatches.filter(connector => Math.abs(Number(connector?.y) - y) < 0.01)
  const slabStairs = stairs.filter(stair => Math.abs(Number(stair?.topY) - y) < 0.01)
  const sourceFootprint = footprint || roomBoundaryMultiPolygon(room, roomLookup)
  const skylightOpenings = slabSkylights.map(connector => [[[
    [Number(connector.x), Number(connector.z)],
    [Number(connector.x) + Number(connector.width || 1), Number(connector.z)],
    [Number(connector.x) + Number(connector.width || 1), Number(connector.z) + Number(connector.depth || 1)],
    [Number(connector.x), Number(connector.z) + Number(connector.depth || 1)],
    [Number(connector.x), Number(connector.z)],
  ]]])
  const stairOpenings = slabStairs.map(stair => stairOpeningMultiPolygon(stair, { storyHeight: STORY_HEIGHT }))
  const hatchOpenings = slabHatches.map(connector => [[[
    [Number(connector.x), Number(connector.z)],
    [Number(connector.x) + Number(connector.width || 1), Number(connector.z)],
    [Number(connector.x) + Number(connector.width || 1), Number(connector.z) + Number(connector.depth || 1)],
    [Number(connector.x), Number(connector.z) + Number(connector.depth || 1)],
    [Number(connector.x), Number(connector.z)],
  ]]])
  const openings = [...skylightOpenings, ...stairOpenings, ...hatchOpenings]
  const clippedFootprint = openings.length > 0
    ? differenceMultiPolygons(sourceFootprint, ...openings)
    : sourceFootprint
  const rectangles = sourceRectangles
  const materialDescriptor = isCeiling ? room.ceilingMaterial : room.floorMaterial
  const topMaterialDescriptor = materialDescriptor
  const bottomMaterialDescriptor = materialDescriptor
  const topTex = isCeiling ? room.ceilingTex : room.floorTex
  const bottomTex = topTex
  const topProcedural = surfaceMaterialAt(topMaterialDescriptor, showDetails)
  const bottomProcedural = surfaceMaterialAt(bottomMaterialDescriptor, showDetails)
  const top = topProcedural?.faceMaterials[FACE.top] || materialAt(textureMaterials, topTex, FACE.top)
  const bottom = bottomProcedural?.faceMaterials[FACE.bottom]
    || materialAt(textureMaterials, bottomTex, FACE.bottom, FACE.top)
    || top
  const side = topProcedural?.solidMaterial || solidMaterialAt(textureMaterials, topTex) || topProcedural?.faceMaterials[FACE.south] || materialAt(textureMaterials, topTex, FACE.south, FACE.top) || top
  const relief = showDetails ? (topProcedural?.relief || reliefAt(textureMaterials, topTex)) : null
  const cutout = usesCutoutMaterial(topProcedural, textureMaterials, topTex)
    || usesCutoutMaterial(bottomProcedural, textureMaterials, bottomTex)
  const visualThickness = thinGrateThickness(thickness, cutout)
  const visualY = horizontalSurfaceVisualY(y, thickness, visualThickness, isCeiling ? 'bottom' : 'top')
  if (!top) return null

  const hasCurvedBoundary = openings.length > 0 || (Array.isArray(footprintContours)
    || (Array.isArray(room.boundaryArcs) && room.boundaryArcs.length > 0)
    || (Array.isArray(room.geometryClipRoomIds) && room.geometryClipRoomIds.length > 0))
  if (hasCurvedBoundary) {
    if (clippedFootprint.length === 0) return null
    return (
      <CurvedRoomSlab
        room={room}
        roomLookup={roomLookup}
        contours={multiPolygonContours(clippedFootprint)}
        kind={kind}
        y={visualY}
        thickness={visualThickness}
        capMaterial={isCeiling ? bottom : top}
        sideMaterial={side}
        opacity={opacity}
      />
    )
  }

  return (
    <>
      {rectangles.map(rectangle => {
        const minX = rectangle.minX
        const minZ = rectangle.minZ
        const maxX = minX + rectangle.width
        const maxZ = minZ + rectangle.depth
        const minY = visualY - visualThickness / 2
        const maxY = visualY + visualThickness / 2
        const faceUvTransforms = faceUvTransformsForBox(minX, minY, minZ, maxX, maxY, maxZ)
        const faceUvScales = faceUvScalesFromTransforms(faceUvTransforms)
        const faceUvOffsets = faceUvOffsetsFromTransforms(faceUvTransforms)
        const materials = withOpacity([
          withUvTransform(side, faceUvTransforms[0]),
          withUvTransform(side, faceUvTransforms[1]),
          withUvTransform(top, faceUvTransforms[2]),
          withUvTransform(bottom, faceUvTransforms[3]),
          withUvTransform(side, faceUvTransforms[4]),
          withUvTransform(side, faceUvTransforms[5]),
        ], opacity)

        return (
          <mesh
            key={`${kind}:${rectangle.minX}:${rectangle.minZ}:${rectangle.width}:${rectangle.depth}`}
            position={[minX + rectangle.width / 2, visualY, minZ + rectangle.depth / 2]}
            material={materials}
            castShadow
            receiveShadow
            userData={isCeiling ? undefined : { worldSupport: true }}
          >
            <ReliefBoxGeometry
              args={[rectangle.width, visualThickness, rectangle.depth]}
              faceProfiles={[null, null, isCeiling ? null : relief, isCeiling ? relief : null, null, null]}
              faceMask={[false, false, !isCeiling, isCeiling, false, false]}
              faceUvScales={faceUvScales}
              faceUvOffsets={faceUvOffsets}
              maxSegments={reliefMaxSegmentsForRepeats(...faceUvScales.flat())}
            />
          </mesh>
        )
      })}
    </>
  )
}

function shapesFromRoomContours(contours) {
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

function CurvedRoomSlab({ room, roomLookup, contours = null, kind, y, thickness, capMaterial, sideMaterial, opacity }) {
  const isCeiling = kind === 'ceiling'
  const geometries = useMemo(() => shapesFromRoomContours(
    contours || roomBoundaryContours(room, roomLookup),
  ).map(shape => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 1,
      material: 0,
      extrudeMaterial: 1,
    })
    geometry.translate(0, 0, -thickness / 2)
    geometry.rotateX(-Math.PI / 2)
    geometry.computeVertexNormals()
    return geometry
  }), [contours, room, roomLookup, thickness])

  useEffect(() => () => geometries.forEach(geometry => geometry.dispose()), [geometries])
  if (geometries.length === 0) return null
  return (
    <>
      {geometries.map((geometry, index) => (
        <mesh
          key={`${kind}:polygon:${index}`}
          geometry={geometry}
          position={[0, y, 0]}
          material={withOpacity([capMaterial, sideMaterial], opacity)}
          castShadow
          receiveShadow
          userData={isCeiling ? undefined : { worldSupport: true }}
        />
      ))}
    </>
  )
}

function wallProfileJoinNeighbors(wall) {
  const neighbors = [
    wall.profileJoinStart?.front?.neighbor,
    wall.profileJoinStart?.back?.neighbor,
    wall.profileJoinEnd?.front?.neighbor,
    wall.profileJoinEnd?.back?.neighbor,
    wall.profileJoinStart?.neighbor,
    wall.profileJoinEnd?.neighbor,
  ].filter(Boolean)
  return [...new Map(neighbors.map((neighbor, index) => [
    neighbor.id || `${index}:${neighbor.normal?.x}:${neighbor.normal?.z}`,
    neighbor,
  ])).values()]
}

function WallSegment({ wall, textureMaterials, opacity = 1, showDetails = true }) {
  const joinNeighbors = wallProfileJoinNeighbors(wall)
  const joinsProfiledNeighbor = Boolean(
    joinNeighbors.some(neighbor => neighbor.elevationProfileMode),
  )
  if (wall.axis === 'arc' || wall.elevationProfileMode || joinsProfiledNeighbor) {
    return <CurvedWallSegment wall={wall} textureMaterials={textureMaterials} opacity={opacity} showDetails={showDetails} />
  }
  const frontProcedural = surfaceMaterialAt(wall.frontMaterial || wall.material, showDetails)
  const backProcedural = surfaceMaterialAt(wall.backMaterial || wall.frontMaterial || wall.material, showDetails)
  const frontRelief = showDetails ? (frontProcedural?.relief || reliefAt(textureMaterials, wall.frontTex)) : null
  const backRelief = showDetails ? (backProcedural?.relief || reliefAt(textureMaterials, wall.backTex)) : null
  const box = getWallRenderBox(wall)
  const [width, height, depth] = box?.args || [1, 1, 1]
  const thinGrate = usesCutoutMaterial(frontProcedural, textureMaterials, wall.frontTex)
    && usesCutoutMaterial(backProcedural, textureMaterials, wall.backTex || wall.frontTex)
  const visualArgs = thinGrate
    ? wall.axis === 'z'
      ? [thinGrateThickness(width, true), height, depth]
      : [width, height, thinGrateThickness(depth, true)]
    : [width, height, depth]
  const frontBase = frontProcedural?.faceMaterials[FACE.south] || materialAt(textureMaterials, wall.frontTex, FACE.south)
  const backBase = backProcedural?.faceMaterials[FACE.north] || materialAt(textureMaterials, wall.backTex, FACE.north, FACE.south) || frontBase
  const topBase = frontProcedural?.solidMaterial || solidMaterialAt(textureMaterials, wall.topTex || wall.frontTex) || frontProcedural?.faceMaterials[FACE.top] || materialAt(textureMaterials, wall.topTex || wall.frontTex, FACE.top, FACE.south) || frontBase
  const [cx, cy, cz] = box?.position || [0, 0, 0]
  const [visualWidth, visualHeight, visualDepth] = visualArgs
  const minX = cx - visualWidth / 2
  const maxX = cx + visualWidth / 2
  const minY = cy - visualHeight / 2
  const maxY = cy + visualHeight / 2
  const minZ = cz - visualDepth / 2
  const maxZ = cz + visualDepth / 2
  const faceUvTransforms = faceUvTransformsForBox(minX, minY, minZ, maxX, maxY, maxZ)
  const faceUvScales = faceUvScalesFromTransforms(faceUvTransforms)
  const faceUvOffsets = faceUvOffsetsFromTransforms(faceUvTransforms)

  let materials = []
  let faceProfiles
  let faceMask
  if (wall.axis === 'x' || wall.axis === 'segment') {
    const forward = wall.axis === 'segment' || Number(wall.x1) >= Number(wall.x0)
    const sideEast = (forward ? wall.capEnd : wall.capStart) === false
      ? HIDDEN_WALL_CAP_MATERIAL
      : withUvTransform(frontBase, faceUvTransforms[0])
    const sideWest = (forward ? wall.capStart : wall.capEnd) === false
      ? HIDDEN_WALL_CAP_MATERIAL
      : withUvTransform(frontBase, faceUvTransforms[1])
    const top = withUvTransform(topBase, faceUvTransforms[2])
    const bottom = withUvTransform(topBase, faceUvTransforms[3])
    const front = withUvTransform(frontBase, faceUvTransforms[4])
    const back = withUvTransform(backBase, faceUvTransforms[5])
    materials = [sideEast, sideWest, top, bottom, front, back]
    faceProfiles = [null, null, null, null, frontRelief, backRelief]
    faceMask = [false, false, false, false, true, true]
  } else {
    const forward = Number(wall.z1) >= Number(wall.z0)
    const front = withUvTransform(frontBase, faceUvTransforms[0])
    const back = withUvTransform(backBase, faceUvTransforms[1])
    const top = withUvTransform(topBase, faceUvTransforms[2])
    const bottom = withUvTransform(topBase, faceUvTransforms[3])
    const sideSouth = (forward ? wall.capEnd : wall.capStart) === false
      ? HIDDEN_WALL_CAP_MATERIAL
      : withUvTransform(frontBase, faceUvTransforms[4])
    const sideNorth = (forward ? wall.capStart : wall.capEnd) === false
      ? HIDDEN_WALL_CAP_MATERIAL
      : withUvTransform(frontBase, faceUvTransforms[5])
    materials = [front, back, top, bottom, sideSouth, sideNorth]
    faceProfiles = [frontRelief, backRelief, null, null, null, null]
    faceMask = [true, true, false, false, false, false]
  }

  if (!frontBase || !backBase || !box) return null
  const visibleMaterials = withOpacity(materials, opacity)

  return (
    <>
      <mesh
        position={box.position}
        rotation={[0, box.rotationY || 0, 0]}
        material={visibleMaterials}
        castShadow={opacity >= 0.999}
        receiveShadow
      >
        <ReliefBoxGeometry
          args={visualArgs}
          faceProfiles={faceProfiles}
          faceMask={faceMask}
          faceUvScales={faceUvScales}
          faceUvOffsets={faceUvOffsets}
          maxSegments={reliefMaxSegmentsForRepeats(...faceUvScales.flat())}
        />
      </mesh>
      {showDetails && opacity >= 0.999 && (
        <WallBoltHeads
          wall={wall}
          box={{ ...box, args: visualArgs }}
          frontDescriptor={wall.frontMaterial || wall.material || frontRelief}
          backDescriptor={wall.backMaterial || wall.frontMaterial || wall.material || backRelief}
        />
      )}
    </>
  )
}

function addCurvedWallQuad(positions, normals, uvs, geometry, materialIndex, points, faceNormals, faceUvs) {
  const start = positions.length / 3
  const order = [0, 1, 2, 0, 2, 3]
  for (const index of order) {
    const value = points[index]
    positions.push(value[0], value[1], value[2])
    const normal = faceNormals[index]
    normals.push(normal[0], normal[1], normal[2])
    uvs.push(faceUvs[index][0], faceUvs[index][1])
  }
  geometry.addGroup(start, 6, materialIndex)
}

function normalizedElevationProfile(profile) {
  const type = ['curved', 'faceted'].includes(profile?.type) ? profile.type : 'vertical'
  return {
    type,
    depth: type === 'vertical' ? 0 : Math.max(0, Number(profile?.depth) || 0),
    direction: Number(profile?.direction) < 0 ? -1 : 1,
  }
}

function elevationProfileOffset(profile, progress) {
  const normalized = normalizedElevationProfile(profile)
  const t = Math.max(0, Math.min(1, Number(progress) || 0))
  if (normalized.type === 'curved') return normalized.depth * normalized.direction * Math.sin(Math.PI * t)
  if (normalized.type === 'faceted') return normalized.depth * normalized.direction * (1 - Math.abs(t * 2 - 1))
  return 0
}

function quadFaceNormal(points) {
  const a = new THREE.Vector3(...points[0])
  const b = new THREE.Vector3(...points[1])
  const d = new THREE.Vector3(...points[3])
  return b.sub(a).cross(d.sub(a)).normalize().toArray()
}

function profiledWallPath(wall) {
  if (wall.axis === 'arc') {
    const points = sampleWallArcGeometry({
      centerX: wall.centerX,
      centerZ: wall.centerZ,
      radius: wall.radius,
      startAngle: wall.startAngle,
      sweep: wall.sweep,
      from: { x: Number(wall.x0) / SURFACE_FINE, z: Number(wall.z0) / SURFACE_FINE },
      to: { x: Number(wall.x1) / SURFACE_FINE, z: Number(wall.z1) / SURFACE_FINE },
    }, 16)
    return points
  }
  return [
    { x: Number(wall.x0) / SURFACE_FINE, z: Number(wall.z0) / SURFACE_FINE },
    { x: Number(wall.x1) / SURFACE_FINE, z: Number(wall.z1) / SURFACE_FINE },
  ]
}

function profiledWallVerticalLevels(wall) {
  const bottom = Number(wall.y) || 0
  const top = bottom + Math.max(0.01, Number(wall.height) || STORY_HEIGHT)
  const origin = Number.isFinite(Number(wall.elevationProfileOriginY))
    ? Number(wall.elevationProfileOriginY)
    : bottom
  const span = Math.max(0.01, Number(wall.elevationProfileHeight) || (top - bottom))
  const start = Math.max(0, Math.min(1, (bottom - origin) / span))
  const end = Math.max(0, Math.min(1, (top - origin) / span))
  return wallProfileVerticalProgresses(wall, start, end)
    .map(t => ({ t, y: origin + t * span }))
}

function profiledWallFaceDistances(wall, progress, visualThickness = null) {
  const half = Number.isFinite(Number(visualThickness))
    ? Math.max(0.01, Number(visualThickness)) / 2
    : Math.max(1, Number(wall?.thickness) || 1) / (2 * SURFACE_FINE)
  const minimumThickness = Math.max(0.01, half * 0.2)
  let front = half
  let back = -half
  if (wall?.elevationProfileMode === 'translated') {
    const direction = Number(wall.elevationProfileDirection) < 0 ? -1 : 1
    const offset = elevationProfileOffset(wall.elevationProfile, progress) * direction
    front += offset
    back += offset
  } else {
    front += elevationProfileOffset(wall?.frontElevationProfile, progress)
    back -= elevationProfileOffset(wall?.backElevationProfile, progress)
    if (front - back < minimumThickness) {
      if (wall?.frontElevationProfile && !wall?.backElevationProfile) front = back + minimumThickness
      else if (wall?.backElevationProfile && !wall?.frontElevationProfile) back = front - minimumThickness
      else {
        const center = (front + back) / 2
        front = center + minimumThickness / 2
        back = center - minimumThickness / 2
      }
    }
  }
  return { front, back }
}

function wallProfileProgressAtY(wall, y) {
  const origin = Number.isFinite(Number(wall?.elevationProfileOriginY))
    ? Number(wall.elevationProfileOriginY)
    : Number(wall?.y) || 0
  const span = Math.max(0.01, Number(wall?.elevationProfileHeight)
    || Number(wall?.height)
    || STORY_HEIGHT)
  return Math.max(0, Math.min(1, (Number(y) - origin) / span))
}

function joinedWallFacePoint(value, frame, distance, join, side, y) {
  const fallback = [
    value.x + frame.normal.x * distance,
    y,
    value.z + frame.normal.z * distance,
  ]
  const faceJoin = join?.[side]
  const neighbor = faceJoin?.neighbor || join?.neighbor
  const neighborNormal = neighbor?.normal
  const neighborSide = faceJoin?.neighborSide || join?.[`${side}NeighborSide`]
  if (!neighborNormal || !['front', 'back'].includes(neighborSide)) return fallback
  const denominator = frame.tangent.x * Number(neighborNormal.x)
    + frame.tangent.z * Number(neighborNormal.z)
  if (!Number.isFinite(denominator) || Math.abs(denominator) <= 0.2) return fallback
  const neighborProgress = wallProfileProgressAtY(neighbor, y)
  const neighborDistance = profiledWallFaceDistances(neighbor, neighborProgress)[neighborSide]
  const intersection = wallCornerIntersectionPoint({
    point: value,
    tangent: frame.tangent,
    normal: frame.normal,
    distance,
    neighborNormal,
    neighborDistance,
  })
  if (!intersection) return fallback
  return [
    intersection.x,
    y,
    intersection.z,
  ]
}

function makeCurvedWallGeometry(wall, visualThickness = null) {
  const path = profiledWallPath(wall)
  if (path.length < 2) return null
  const cumulative = [0]
  for (let index = 0; index < path.length - 1; index += 1) {
    cumulative.push(cumulative[index] + Math.hypot(
      path[index + 1].x - path[index].x,
      path[index + 1].z - path[index].z,
    ))
  }
  const total = Math.max(1e-6, cumulative.at(-1))
  const pathFrames = path.map((value, index) => {
    const previous = path[Math.max(0, index - 1)]
    const next = path[Math.min(path.length - 1, index + 1)]
    const tangentX = next.x - previous.x
    const tangentZ = next.z - previous.z
    const length = Math.hypot(tangentX, tangentZ) || 1
    const sampledFrame = {
      tangent: { x: tangentX / length, z: tangentZ / length },
      normal: { x: -tangentZ / length, z: tangentX / length },
    }
    if (index === 0 && wall.profileJoinStart) {
      return { tangent: wall.profileJoinStart.tangent, normal: wall.profileJoinStart.normal }
    }
    if (index === path.length - 1 && wall.profileJoinEnd) {
      return { tangent: wall.profileJoinEnd.tangent, normal: wall.profileJoinEnd.normal }
    }
    return sampledFrame
  })
  const verticalLevels = profiledWallVerticalLevels(wall)
  if (verticalLevels.length < 2) return null

  const surfaces = verticalLevels.map(level => path.map((value, pathIndex) => {
    const frame = pathFrames[pathIndex]
    const distances = profiledWallFaceDistances(wall, level.t, visualThickness)
    const join = pathIndex === 0
      ? wall.profileJoinStart
      : pathIndex === path.length - 1
        ? wall.profileJoinEnd
        : null
    return {
      front: joinedWallFacePoint(value, frame, distances.front, join, 'front', level.y),
      back: joinedWallFacePoint(value, frame, distances.back, join, 'back', level.y),
    }
  }))
  const geometry = new THREE.BufferGeometry()
  const positions = []
  const normals = []
  const uvs = []
  for (let verticalIndex = 0; verticalIndex < verticalLevels.length - 1; verticalIndex += 1) {
    const v0 = verticalLevels[verticalIndex].t
    const v1 = verticalLevels[verticalIndex + 1].t
    for (let index = 0; index < path.length - 1; index += 1) {
      const u0 = cumulative[index] / total
      const u1 = cumulative[index + 1] / total
      const lowerA = surfaces[verticalIndex][index]
      const lowerB = surfaces[verticalIndex][index + 1]
      const upperA = surfaces[verticalIndex + 1][index]
      const upperB = surfaces[verticalIndex + 1][index + 1]
      const frontPoints = [lowerA.front, lowerB.front, upperB.front, upperA.front]
      const frontNormal = quadFaceNormal(frontPoints)
      addCurvedWallQuad(positions, normals, uvs, geometry, 0, frontPoints,
        [frontNormal, frontNormal, frontNormal, frontNormal], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]])
      const backPoints = [lowerB.back, lowerA.back, upperA.back, upperB.back]
      const backNormal = quadFaceNormal(backPoints)
      addCurvedWallQuad(positions, normals, uvs, geometry, 1, backPoints,
        [backNormal, backNormal, backNormal, backNormal], [[1 - u1, v0], [1 - u0, v0], [1 - u0, v1], [1 - u1, v1]])
    }
  }
  for (const verticalIndex of [0, verticalLevels.length - 1]) {
    for (let index = 0; index < path.length - 1; index += 1) {
      const a = surfaces[verticalIndex][index]
      const b = surfaces[verticalIndex][index + 1]
      const topCap = verticalIndex > 0
      const points = topCap
        ? [a.front, b.front, b.back, a.back]
        : [a.back, b.back, b.front, a.front]
      const normal = topCap ? [0, 1, 0] : [0, -1, 0]
      addCurvedWallQuad(positions, normals, uvs, geometry, topCap ? 2 : 3, points,
        [normal, normal, normal, normal], [[0, 0], [1, 0], [1, 1], [0, 1]])
    }
  }
  for (const pathIndex of [0, path.length - 1]) {
    if (pathIndex === 0 && wall.capStart === false) continue
    if (pathIndex === path.length - 1 && wall.capEnd === false) continue
    if (pathIndex === 0 && wall.profileJoinStart) continue
    if (pathIndex === path.length - 1 && wall.profileJoinEnd) continue
    for (let verticalIndex = 0; verticalIndex < verticalLevels.length - 1; verticalIndex += 1) {
      const lower = surfaces[verticalIndex][pathIndex]
      const upper = surfaces[verticalIndex + 1][pathIndex]
      const reverse = pathIndex === 0
      const points = reverse
        ? [lower.back, lower.front, upper.front, upper.back]
        : [lower.front, lower.back, upper.back, upper.front]
      const normal = quadFaceNormal(points)
      addCurvedWallQuad(positions, normals, uvs, geometry, 2, points,
        [normal, normal, normal, normal], [[0, 0], [1, 0], [1, 1], [0, 1]])
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function CurvedWallSegment({ wall, textureMaterials, opacity = 1, showDetails = true }) {
  const frontProcedural = surfaceMaterialAt(wall.frontMaterial || wall.material, showDetails)
  const backProcedural = surfaceMaterialAt(wall.backMaterial || wall.frontMaterial || wall.material, showDetails)
  const frontBase = frontProcedural?.faceMaterials[FACE.south] || materialAt(textureMaterials, wall.frontTex, FACE.south)
  const backBase = backProcedural?.faceMaterials[FACE.north]
    || materialAt(textureMaterials, wall.backTex, FACE.north, FACE.south)
    || frontBase
  const topBase = frontProcedural?.solidMaterial
    || solidMaterialAt(textureMaterials, wall.topTex || wall.frontTex)
    || frontProcedural?.faceMaterials[FACE.top]
    || materialAt(textureMaterials, wall.topTex || wall.frontTex, FACE.top, FACE.south)
    || frontBase
  const thinGrate = usesCutoutMaterial(frontProcedural, textureMaterials, wall.frontTex)
    && usesCutoutMaterial(backProcedural, textureMaterials, wall.backTex || wall.frontTex)
  const visualThickness = thinGrate ? GRATE_VISUAL_THICKNESS : null
  const geometry = useMemo(() => makeCurvedWallGeometry(wall, visualThickness), [wall, visualThickness])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry || !frontBase || !backBase || !topBase) return null
  const length = wall.axis === 'arc'
    ? Math.max(0.05, Math.abs(Number(wall.radius) * Number(wall.sweep)))
    : Math.max(0.05, Math.hypot(Number(wall.x1) - Number(wall.x0), Number(wall.z1) - Number(wall.z0)) / SURFACE_FINE)
  const height = Math.max(0.05, Number(wall.height) || STORY_HEIGHT)
  const thickness = visualThickness || Math.max(1, Number(wall.thickness) || 1) / SURFACE_FINE
  const offset = Number(wall.curveOffset0) || 0
  const materials = withOpacity([
    withRepeat(frontBase, length, height, offset, Number(wall.y) || 0),
    withRepeat(backBase, -length, height, -offset - length, Number(wall.y) || 0),
    withRepeat(topBase, length, thickness, offset, 0),
    withRepeat(topBase, length, thickness, offset, 0),
  ], opacity)
  return (
    <mesh geometry={geometry} material={materials} castShadow={opacity >= 0.999} receiveShadow />
  )
}

function cloneWallPiece(wall, suffix, patch) {
  return {
    ...wall,
    ...patch,
    id: `${wall.id}:cut:${suffix}`,
    logicalWallId: wall.logicalWallId || wall.id,
  }
}

function wallOpacityY(wall) {
  return Number.isFinite(Number(wall?.opacityY)) ? Number(wall.opacityY) : wall?.y
}

function isFuturisticDoorConnector(connector) {
  const key = String(connector?.modelBuiltinKey || '').toLowerCase()
  const category = String(connector?.modelCategory || '').toLowerCase()
  return key.includes('futuristic_doors') || category.includes('futuristic_doors')
}

function fallbackFuturisticDoorCutWidth(connector) {
  const key = String(connector?.modelBuiltinKey || '').toLowerCase()
  const label = String(connector?.modelLabel || '').toLowerCase()
  if (key.includes('06_large_hangar') || key.includes('07_large_glass_hangar') || label.includes('hangar')) return 4
  return 1.5
}

function doorStructuralCutWidth(connector) {
  const geometry = connector?.modelGeometry || {}
  const explicitCut = Number(geometry.wallCutWidth || geometry.footprintWidth || geometry.footprint_width_m)
  if (explicitCut) return Math.max(0.25, explicitCut)

  if (isFuturisticDoorConnector(connector)) {
    const openingWidth = Number(geometry.openingWidth || geometry.doorPanelWidth || geometry.door_panel_width_m)
    if (openingWidth) return Math.max(0.25, openingWidth)
    return fallbackFuturisticDoorCutWidth(connector)
  }

  const declaredWidth = Math.max(0.25, Number(geometry.width) || 0)
  const storedWidth = Math.max(0.25, Number(connector?.width) || 0)
  if (storedWidth > declaredWidth + 0.01) return storedWidth
  if (declaredWidth > 0) return declaredWidth
  return storedWidth || 1
}

function doorOpeningWidth(connector) {
  const structuralWidth = doorStructuralCutWidth(connector)
  return Math.max(0.25, structuralWidth - DOOR_FRAME_WALL_OVERLAP * 2)
}

function doorOpeningInterval(connector, center) {
  const width = doorOpeningWidth(connector)
  return {
    min: center - width / 2,
    max: center + width / 2,
  }
}

function doorOpeningForConnector(connector, wall) {
  if (!connector || !['door', 'window', 'screen-window'].includes(connector.type) || !wall) return null
  const verticalRange = wallOpeningVerticalRange(connector, wall)
  if (!verticalRange) return null

  if (wall.axis === 'arc') {
    if (connector.axis !== 'segment' || !connector.curveId || connector.curveId !== wall.curveId) return null
    const wallOffset0 = Number(wall.curveOffset0)
    const wallOffset1 = Number(wall.curveOffset1)
    const connectorOffset = Number(connector.curveOffset)
    if (![wallOffset0, wallOffset1, connectorOffset].every(Number.isFinite)) return null
    const opening = doorOpeningInterval(connector, connectorOffset)
    const wallMin = Math.min(wallOffset0, wallOffset1)
    const wallMax = Math.max(wallOffset0, wallOffset1)
    const min = Math.max(wallMin, opening.min)
    const max = Math.min(wallMax, opening.max)
    if (max <= min + 1e-6) return null
    return {
      curve: true,
      min,
      max,
      startT: (min - wallOffset0) / (wallOffset1 - wallOffset0),
      endT: (max - wallOffset0) / (wallOffset1 - wallOffset0),
      ...verticalRange,
    }
  }

  if (connector.axis !== wall.axis) return null

  const fine = SURFACE_FINE
  const alongStart = wall.axis === 'x' ? Number(wall.x0) : Number(wall.z0)
  const alongEnd = wall.axis === 'x' ? Number(wall.x1) : Number(wall.z1)
  const wallMin = Math.min(alongStart, alongEnd)
  const wallMax = Math.max(alongStart, alongEnd)
  const wallLength = wallMax - wallMin
  if (wallLength <= 0.001) return null

  const connectorLine = wall.axis === 'x' ? Number(connector.z0) : Number(connector.x0)
  const wallLine = wall.axis === 'x' ? Number(wall.z0) : Number(wall.x0)
  if (Math.abs(connectorLine - wallLine) > 0.01) return null

  const connectorStart = wall.axis === 'x' ? Number(connector.x0) : Number(connector.z0)
  const connectorEnd = wall.axis === 'x' ? Number(connector.x1) : Number(connector.z1)
  const connectorCenterFine = Number.isFinite(Number(connector.alongCenter))
    ? Number(connector.alongCenter)
    : (connectorStart + connectorEnd) / 2
  const connectorCenterWorld = connectorCenterFine / fine

  const openingInterval = doorOpeningInterval(connector, connectorCenterWorld)
  const cutMin = openingInterval.min * fine
  const cutMax = openingInterval.max * fine
  const adjustedMin = Math.max(wallMin, cutMin)
  const adjustedMax = Math.min(wallMax, cutMax)
  if (adjustedMax <= adjustedMin + 0.01) return null

  return {
    min: adjustedMin,
    max: adjustedMax,
    ...verticalRange,
  }
}

function splitWallForDoorConnector(wall, connector) {
  const opening = doorOpeningForConnector(connector, wall)
  if (!opening) return [wall]

  if (opening.curve) {
    const fromT = Math.max(0, Math.min(opening.startT, opening.endT))
    const toT = Math.min(1, Math.max(opening.startT, opening.endT))
    const curvePatch = (startT, endT) => {
      const startAngle = Number(wall.startAngle) + Number(wall.sweep) * startT
      const sweep = Number(wall.sweep) * (endT - startT)
      const endAngle = startAngle + sweep
      return {
        startAngle,
        sweep,
        curveOffset0: Number(wall.curveOffset0) + (Number(wall.curveOffset1) - Number(wall.curveOffset0)) * startT,
        curveOffset1: Number(wall.curveOffset0) + (Number(wall.curveOffset1) - Number(wall.curveOffset0)) * endT,
        x0: (Number(wall.centerX) + Math.cos(startAngle) * Number(wall.radius)) * SURFACE_FINE,
        z0: (Number(wall.centerZ) + Math.sin(startAngle) * Number(wall.radius)) * SURFACE_FINE,
        x1: (Number(wall.centerX) + Math.cos(endAngle) * Number(wall.radius)) * SURFACE_FINE,
        z1: (Number(wall.centerZ) + Math.sin(endAngle) * Number(wall.radius)) * SURFACE_FINE,
      }
    }
    const pieces = []
    const epsilon = 1e-6
    if (fromT > epsilon) pieces.push(cloneWallPiece(wall, `before:${opening.min}`, {
      ...curvePatch(0, fromT),
      capEnd: false,
      profileJoinEnd: null,
      profileJoinEndMiter: null,
    }))
    if (toT < 1 - epsilon) pieces.push(cloneWallPiece(wall, `after:${opening.max}`, {
      ...curvePatch(toT, 1),
      capStart: false,
      profileJoinStart: null,
      profileJoinStartMiter: null,
    }))
    if (opening.bottom > opening.wallBottom + 0.01 && toT > fromT + epsilon) {
      pieces.push(cloneWallPiece(wall, `bottom:${opening.min}:${opening.max}`, {
        ...curvePatch(fromT, toT),
        capStart: false,
        capEnd: false,
        opacityY: wallOpacityY(wall),
        y: opening.wallBottom,
        height: opening.bottom - opening.wallBottom,
        profileJoinStart: null,
        profileJoinEnd: null,
        profileJoinStartMiter: null,
        profileJoinEndMiter: null,
      }))
    }
    if (opening.wallTop > opening.top + 0.01 && toT > fromT + epsilon) {
      pieces.push(cloneWallPiece(wall, `top:${opening.min}:${opening.max}`, {
        ...curvePatch(fromT, toT),
        capStart: false,
        capEnd: false,
        opacityY: wallOpacityY(wall),
        y: opening.top,
        height: opening.wallTop - opening.top,
        profileJoinStart: null,
        profileJoinEnd: null,
        profileJoinStartMiter: null,
        profileJoinEndMiter: null,
      }))
    }
    return pieces
  }

  const alongStart = wall.axis === 'x' ? Number(wall.x0) : Number(wall.z0)
  const alongEnd = wall.axis === 'x' ? Number(wall.x1) : Number(wall.z1)
  const wallMin = Math.min(alongStart, alongEnd)
  const wallMax = Math.max(alongStart, alongEnd)
  const pieces = []
  const epsilon = 0.01
  const forward = alongEnd >= alongStart
  const segmentPatch = (start, end) => (
    wall.axis === 'x'
      ? { x0: forward ? start : end, x1: forward ? end : start }
      : { z0: forward ? start : end, z1: forward ? end : start }
  )

  if (opening.min > wallMin + epsilon) {
    pieces.push(cloneWallPiece(wall, `before:${opening.min}`, {
      ...segmentPatch(wallMin, opening.min),
      capEnd: false,
      profileJoinStart: forward ? wall.profileJoinStart : null,
      profileJoinEnd: forward ? null : wall.profileJoinEnd,
      profileJoinStartMiter: forward ? wall.profileJoinStartMiter : null,
      profileJoinEndMiter: forward ? null : wall.profileJoinEndMiter,
    }))
  }
  if (opening.max < wallMax - epsilon) {
    pieces.push(cloneWallPiece(wall, `after:${opening.max}`, {
      ...segmentPatch(opening.max, wallMax),
      capStart: false,
      profileJoinStart: forward ? null : wall.profileJoinStart,
      profileJoinEnd: forward ? wall.profileJoinEnd : null,
      profileJoinStartMiter: forward ? null : wall.profileJoinStartMiter,
      profileJoinEndMiter: forward ? wall.profileJoinEndMiter : null,
    }))
  }
  if (opening.bottom > opening.wallBottom + epsilon && opening.max > opening.min + epsilon) {
    pieces.push(cloneWallPiece(wall, `bottom:${opening.min}:${opening.max}`, {
      ...segmentPatch(opening.min, opening.max),
      capStart: false,
      capEnd: false,
      opacityY: wallOpacityY(wall),
      y: opening.wallBottom,
      height: opening.bottom - opening.wallBottom,
      profileJoinStart: null,
      profileJoinEnd: null,
      profileJoinStartMiter: null,
      profileJoinEndMiter: null,
    }))
  }
  if (opening.wallTop > opening.top + epsilon && opening.max > opening.min + epsilon) {
    pieces.push(cloneWallPiece(wall, `top:${opening.min}:${opening.max}`, {
      ...segmentPatch(opening.min, opening.max),
      capStart: false,
      capEnd: false,
      opacityY: wallOpacityY(wall),
      y: opening.top,
      height: opening.wallTop - opening.top,
      profileJoinStart: null,
      profileJoinEnd: null,
      profileJoinStartMiter: null,
      profileJoinEndMiter: null,
    }))
  }

  return pieces
}

// Co-localise avec les helpers geometriques prives utilises pour decouper les murs.
// eslint-disable-next-line react-refresh/only-export-components
export function cutWallsForDoorConnectors(walls, connectors) {
  const doors = Object.values(connectors || {}).filter(connector => ['door', 'window', 'screen-window'].includes(connector?.type))
  if (doors.length === 0) return walls

  let pieces = walls
  for (const door of doors) {
    pieces = pieces.flatMap(wall => splitWallForDoorConnector(wall, door))
  }
  return pieces
}

function connectorDoorBox(connector) {
  if (!connector) return null
  const fine = SURFACE_FINE
  const wallDepth = Math.max(0.28, (Number(connector.thickness) || 1) / fine + 0.12)
  const modelGeometry = connector.modelGeometry || {}
  const x0 = Number(connector.x0) / fine
  const x1 = Number(connector.x1) / fine
  const z0 = Number(connector.z0) / fine
  const z1 = Number(connector.z1) / fine
  const geometryWidth = Number(modelGeometry.width) || null
  const geometryDepth = Number(modelGeometry.depth) || null
  const segmentLength = Math.hypot(x1 - x0, z1 - z0)
  const alongLength = Math.max(
    0.2,
    geometryWidth || Number(connector.width) || segmentLength,
  )
  const modelDepth = Math.max(0.05, geometryDepth || Number(connector.depth) || wallDepth)
  const fallbackDepth = Math.max(wallDepth, modelDepth)
  const width = connector.axis === 'segment' || connector.axis === 'x' ? alongLength : fallbackDepth
  const depth = connector.axis === 'segment' ? fallbackDepth : connector.axis === 'z' ? alongLength : fallbackDepth
  const x = connector.axis === 'segment' || connector.axis === 'x' ? (x0 + x1) / 2 : x0
  const z = connector.axis === 'segment' || connector.axis === 'z' ? (z0 + z1) / 2 : z0
  const height = Math.max(0.5, Number(modelGeometry.height) || Number(connector.height) || 2)
  return {
    position: [x, (Number(connector.y) || 0) + height / 2, z],
    floorPosition: [x, Number(connector.y) || 0, z],
    args: [width, height, depth],
    alongLength,
    modelDepth,
    fallbackDepth,
    wallDepth,
    rotationY: connector.axis === 'segment'
      ? Number(connector.rotationY) || -Math.atan2(z1 - z0, x1 - x0)
      : connector.axis === 'z' ? Math.PI / 2 : 0,
  }
}

function connectorAssetUrl(connector) {
  const rawUrl = connector?.modelGlbUrl
  if (!rawUrl) return null
  const versionedUrl = rawUrl.startsWith('builtin-models/') && !rawUrl.includes('?')
    ? `${rawUrl}?v=door-model-refresh-20260709`
    : rawUrl
  if (/^https?:\/\//i.test(versionedUrl)) return versionedUrl
  return `${import.meta.env.VITE_API_URL}/api/assets/${versionedUrl}`
}

function DoorConnectorFallback({ connector, opacity = 1 }) {
  const box = connectorDoorBox(connector)
  if (!box) return null
  return (
    <mesh position={box.position} rotation={[0, box.rotationY, 0]} renderOrder={30}>
      <boxGeometry args={box.args} />
      <meshBasicMaterial color="#f97316" transparent opacity={Math.min(0.92, opacity)} depthWrite={opacity >= 0.95} />
    </mesh>
  )
}

function ConnectorSelectionOutline({ connector }) {
  const box = connectorDoorBox(connector)
  if (!box) return null
  return (
    <mesh position={box.position} rotation={[0, box.rotationY, 0]} renderOrder={45}>
      <boxGeometry args={[
        box.args[0] + 0.08,
        box.args[1] + 0.08,
        box.args[2] + 0.08,
      ]} />
      <meshBasicMaterial color="#fbbf24" wireframe transparent opacity={0.95} depthWrite={false} />
    </mesh>
  )
}

function WindowEmbrasure({ connector, opacity = 1 }) {
  const box = connectorDoorBox(connector)
  if (!box || !['window', 'screen-window'].includes(connector?.type)) return null
  const profileDepth = Math.max(
    Math.abs(Number(connector.mountElevationProfile?.depth) || 0),
    Math.abs(Number(connector.mountFrontElevationProfile?.depth) || 0),
    Math.abs(Number(connector.mountBackElevationProfile?.depth) || 0),
  )
  const revealDepth = Math.max(box.wallDepth, box.modelDepth + profileDepth)
  const width = box.alongLength
  const height = box.args[1]
  const edge = Math.min(0.08, Math.max(0.035, width * 0.035))
  const color = connector.type === 'screen-window' ? '#090f13' : '#15252d'
  return (
    <group position={box.floorPosition} rotation={[0, box.rotationY, 0]} renderOrder={29}>
      <mesh position={[0, edge / 2, 0]}><boxGeometry args={[width + edge * 2, edge, revealDepth]} /><meshStandardMaterial color={color} metalness={0.62} roughness={0.34} transparent={opacity < 0.999} opacity={opacity} /></mesh>
      <mesh position={[0, height - edge / 2, 0]}><boxGeometry args={[width + edge * 2, edge, revealDepth]} /><meshStandardMaterial color={color} metalness={0.62} roughness={0.34} transparent={opacity < 0.999} opacity={opacity} /></mesh>
      <mesh position={[-width / 2 - edge / 2, height / 2, 0]}><boxGeometry args={[edge, height, revealDepth]} /><meshStandardMaterial color={color} metalness={0.62} roughness={0.34} transparent={opacity < 0.999} opacity={opacity} /></mesh>
      <mesh position={[width / 2 + edge / 2, height / 2, 0]}><boxGeometry args={[edge, height, revealDepth]} /><meshStandardMaterial color={color} metalness={0.62} roughness={0.34} transparent={opacity < 0.999} opacity={opacity} /></mesh>
    </group>
  )
}

function elevatorDisplayY(state, fallbackY, now = Date.now()) {
  if (state?.phase !== 'moving' || !Number.isFinite(Number(state.transitionEndsAt))) {
    return Number.isFinite(Number(state?.positionY)) ? Number(state.positionY) : fallbackY
  }
  const startedAt = Number(state.transitionStartedAt)
  const endsAt = Number(state.transitionEndsAt)
  const fromY = Number(state.movementFromY)
  const toY = Number(state.movementToY)
  if (![startedAt, endsAt, fromY, toY].every(Number.isFinite) || endsAt <= startedAt) return fallbackY
  const ratio = Math.max(0, Math.min(1, (now - startedAt) / (endsAt - startedAt)))
  return fromY + (toY - fromY) * ratio
}

function AnimatedElevatorCabin({ state, fallbackY, children }) {
  const ref = useRef()
  useFrame(() => {
    if (ref.current) ref.current.position.y = elevatorDisplayY(state, fallbackY)
  })
  return <group ref={ref} position={[0, elevatorDisplayY(state, fallbackY), 0]}>{children}</group>
}

function doorControlMountSide(name) {
  const normalized = String(name || '').toLowerCase()
  if (!normalized.includes('control') && !normalized.includes('keypad') && !normalized.includes('screen')) return null
  if (normalized.includes('_front_')) return 'front'
  if (normalized.includes('_back_')) return 'back'
  return null
}

function topLevelDoorControlNodes(scene) {
  const controls = []
  scene.traverse((object) => {
    if (!doorControlMountSide(object.name)) return
    let ancestor = object.parent
    while (ancestor && ancestor !== scene) {
      if (doorControlMountSide(ancestor.name)) return
      ancestor = ancestor.parent
    }
    controls.push(object)
  })
  return controls
}

function mountDoorControlsOnCurvedWall(
  scene,
  curveWall,
  uniformScale,
  connectorAxis,
  connectorAnchorX,
  connectorAnchorZ,
  connectorNormalX,
  connectorNormalZ,
) {
  if (!scene || connectorAxis !== 'segment' || curveWall?.axis !== 'arc') return
  const scale = Math.abs(Number(uniformScale))
  if (!Number.isFinite(scale) || scale <= 1e-8) return
  const radius = Number(curveWall.radius) / scale
  const centerX = Number(curveWall.centerX)
  const centerZ = Number(curveWall.centerZ)
  const anchorX = Number(connectorAnchorX)
  const anchorZ = Number(connectorAnchorZ)
  const normalX = Number(connectorNormalX)
  const normalZ = Number(connectorNormalZ)
  if (![radius, centerX, centerZ, anchorX, anchorZ, normalX, normalZ].every(Number.isFinite)) return
  const centerDotNormal = (centerX - anchorX) * normalX + (centerZ - anchorZ) * normalZ
  if (Math.abs(centerDotNormal) <= 1e-8) return
  const centerSign = Math.sign(centerDotNormal)

  const groups = new Map()
  for (const object of topLevelDoorControlNodes(scene)) {
    const side = doorControlMountSide(object.name)
    const key = `${object.parent?.uuid || 'root'}:${side}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(object)
  }

  const yAxis = new THREE.Vector3(0, 1, 0)
  for (const objects of groups.values()) {
    const mountX = objects.reduce((sum, object) => sum + Number(object.position.x || 0), 0) / objects.length
    const frame = arcSurfaceMountFrame(radius, mountX, centerSign)
    if (!frame) continue
    const rotation = new THREE.Quaternion().setFromAxisAngle(yAxis, frame.rotationY)
    for (const object of objects) {
      const relative = new THREE.Vector3(object.position.x - mountX, 0, object.position.z).applyQuaternion(rotation)
      object.position.x = mountX + relative.x
      object.position.z = frame.normalOffset + relative.z
      object.quaternion.premultiply(rotation)
    }
  }
}

function DoorConnectorModel({ connector, curveWall = null, opacity = 1, selected = false }) {
  const url = connectorAssetUrl(connector)
  const box = connectorDoorBox(connector)
  const geometry = connector.modelGeometry || {}
  const geometryHeight = Number(geometry.height)
  const connectorHeight = connector.height
  const connectorAxis = connector.axis
  const connectorAnchorX = connector.anchorX
  const connectorAnchorZ = connector.anchorZ
  const connectorNormalX = connector.normalX
  const connectorNormalZ = connector.normalZ
  const materialSlots = useMemo(
    () => connectorModelMaterialSlots(connector),
    [connector],
  )
  const materialOverrides = connector?.modelMaterialOverrides || connector?.materialOverrides || null
  const modelState = connector?.runtimeState?.state || connector?.state || 'closed'
  const windowState = ['window', 'screen-window'].includes(connector.type) ? modelState : 'transparent'
  const facingRotationY = connector?.modelFacing === 'back' ? Math.PI : 0
  const preserveAuthoredOrigin = connector?.modelGeometry?.origin === 'floor-center' || Boolean(connector?.modelBuiltinKey)
  const { scene: sourceScene, animations } = useGLTF(url)
  const { scene, offset, uniformScale } = useMemo(() => {
    const clone = SkeletonUtils.clone(sourceScene)
    clone.traverse((child) => {
      if (!child.isMesh || !child.material) return
      child.castShadow = true
      child.receiveShadow = true
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      const cloned = materials.map(material => {
        const next = applyMaterialSlotOverrides(material.clone(), materialSlots, materialOverrides)
        const isGlass = /glass|verre|vitre/i.test(next.name || material.name || '')
        if (isGlass && ['window', 'screen-window'].includes(connector.type)) {
          if (windowState === 'transparent') {
            next.transparent = true
            next.opacity = Math.min(Number(next.opacity) || 0.3, 0.34)
            next.metalness = 0.08
            next.roughness = 0.16
            next.depthWrite = false
          } else if (windowState === 'mirror') {
            next.transparent = false
            next.opacity = 1
            next.color?.set?.('#b9c7d5')
            next.metalness = 1
            next.roughness = 0.08
            next.depthWrite = true
          } else {
            next.transparent = false
            next.opacity = 1
            next.color?.set?.('#182432')
            next.metalness = 0.35
            next.roughness = 0.32
            next.depthWrite = true
          }
        }
        next.transparent = opacity < 0.999 || next.transparent
        next.opacity = Math.min(next.opacity ?? 1, opacity)
        next.depthWrite = opacity >= 0.999 && !next.transparent
        next.needsUpdate = true
        return next
      })
      child.material = Array.isArray(child.material) ? cloned : cloned[0]
    })
    clone.updateWorldMatrix(true, true)
    const bounds = new THREE.Box3().setFromObject(clone)
    const modelSize = new THREE.Vector3()
    const modelCenter = new THREE.Vector3()
    bounds.getSize(modelSize)
    bounds.getCenter(modelCenter)
    const modelOffset = new THREE.Vector3(
      preserveAuthoredOrigin ? 0 : -modelCenter.x,
      -bounds.min.y,
      preserveAuthoredOrigin ? 0 : -modelCenter.z,
    )
    const modelHeight = Math.max(0.01, modelSize.y || geometryHeight || Number(connectorHeight) || 2)
    const targetHeight = Math.max(0.5, Number(connectorHeight) || geometryHeight || 2)
    const scale = targetHeight / modelHeight
    mountDoorControlsOnCurvedWall(
      clone,
      curveWall,
      scale,
      connectorAxis,
      connectorAnchorX,
      connectorAnchorZ,
      connectorNormalX,
      connectorNormalZ,
    )
    return {
      scene: clone,
      offset: modelOffset,
      uniformScale: scale,
    }
  }, [sourceScene, opacity, preserveAuthoredOrigin, materialSlots, materialOverrides, geometryHeight, connectorHeight, connector.type, windowState,
    connectorAxis, connectorAnchorX, connectorAnchorZ, connectorNormalX, connectorNormalZ, curveWall])
  const selectionHalos = useMemo(() => attachEntitySelectionHalo(scene), [scene])
  useModelStateAnimation(scene, animations, modelState)

  useEffect(() => {
    setEntitySelectionHaloVisible(selectionHalos, selected)
  }, [selected, selectionHalos])

  useEffect(() => () => disposeEntitySelectionHalo(selectionHalos), [selectionHalos])

  if (!url || !box || !scene) return null

  return (
    <group position={box.floorPosition} rotation={[0, box.rotationY + facingRotationY, 0]} scale={uniformScale} renderOrder={31}>
      <primitive object={scene} position={offset} />
    </group>
  )
}

function SkylightConnectorModel({ connector, opacity = 1 }) {
  const url = connectorAssetUrl(connector)
  const { scene: sourceScene } = useGLTF(url)
  const materialSlots = useMemo(() => normalizeModelMaterialSlots(connector?.modelGeometry), [connector?.modelGeometry])
  const materialOverrides = connector?.modelMaterialOverrides || connector?.materialOverrides || null
  const scene = useMemo(() => {
    const clone = SkeletonUtils.clone(sourceScene)
    clone.traverse(child => {
      if (!child.isMesh || !child.material) return
      child.castShadow = opacity >= 0.999
      child.receiveShadow = true
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      const next = materials.map(material => {
        const value = applyMaterialSlotOverrides(material.clone(), materialSlots, materialOverrides)
        value.transparent = value.transparent || opacity < 0.999
        value.opacity = Math.min(value.opacity ?? 1, opacity)
        if (value.transparent) value.depthWrite = false
        value.needsUpdate = true
        return value
      })
      child.material = Array.isArray(child.material) ? next : next[0]
    })
    return clone
  }, [sourceScene, materialSlots, materialOverrides, opacity])
  const width = Math.max(1, Number(connector.width) || 1)
  const depth = Math.max(1, Number(connector.depth) || 1)
  return (
    <group position={[Number(connector.x) + width / 2, Number(connector.y) || 0, Number(connector.z) + depth / 2]} rotation={[0, Number(connector.rotationY) || 0, 0]} renderOrder={31}>
      <primitive object={scene} />
    </group>
  )
}

function SkylightSelectionOutline({ connector }) {
  const width = Math.max(1, Number(connector.width) || 1)
  const depth = Math.max(1, Number(connector.depth) || 1)
  const height = Math.max(0.08, Number(connector.height) || 0.1)
  return (
    <mesh position={[Number(connector.x) + width / 2, (Number(connector.y) || 0) + height / 2, Number(connector.z) + depth / 2]} renderOrder={45}>
      <boxGeometry args={[width + 0.08, height + 0.08, depth + 0.08]} />
      <meshBasicMaterial color="#fbbf24" wireframe transparent opacity={0.95} depthWrite={false} />
    </mesh>
  )
}

function HatchConnectorModel({ connector, opacity = 1, selected = false }) {
  const url = connectorAssetUrl(connector)
  const { scene: sourceScene, animations } = useGLTF(url)
  const materialSlots = useMemo(() => connectorModelMaterialSlots(connector), [connector])
  const materialOverrides = connector?.modelMaterialOverrides || connector?.materialOverrides || null
  const modelState = connector?.runtimeState?.state || connector?.state || 'closed'
  const supportsWorld = !['open', 'destroyed'].includes(modelState)
  const geometry = connector?.modelGeometry || {}
  const width = Math.max(0.2, Number(connector.width) || 1)
  const depth = Math.max(0.2, Number(connector.depth) || 1)
  const thickness = Math.max(0.04, Number(connector.height) || 0.12)
  const { scene, offset, uniformScale } = useMemo(() => {
    const clone = SkeletonUtils.clone(sourceScene)
    clone.traverse(child => {
      if (!child.isMesh || !child.material) return
      child.castShadow = opacity >= 0.999
      child.receiveShadow = true
      child.userData = {
        ...child.userData,
        ...(supportsWorld ? {
          worldSupport: true,
          worldFeatureId: connector.worldId || connector.id,
        } : {}),
      }
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      const next = materials.map(material => {
        const value = applyMaterialSlotOverrides(material.clone(), materialSlots, materialOverrides)
        value.transparent = value.transparent || opacity < 0.999
        value.opacity = Math.min(value.opacity ?? 1, opacity)
        if (value.transparent) value.depthWrite = false
        value.needsUpdate = true
        return value
      })
      child.material = Array.isArray(child.material) ? next : next[0]
    })
    clone.updateWorldMatrix(true, true)
    const bounds = new THREE.Box3().setFromObject(clone)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    bounds.getSize(size)
    bounds.getCenter(center)
    const declaredWidth = Math.max(0.01, Number(geometry.width) || size.x || width)
    const declaredDepth = Math.max(0.01, Number(geometry.depth) || size.z || depth)
    const scale = Math.min(width / declaredWidth, depth / declaredDepth)
    const preserveOrigin = geometry.origin === 'hatch-center'
    return {
      scene: clone,
      offset: preserveOrigin
        ? new THREE.Vector3(0, 0, 0)
        : new THREE.Vector3(-center.x, -bounds.min.y, -center.z),
      uniformScale: scale,
    }
  }, [sourceScene, opacity, supportsWorld, connector.worldId, connector.id, materialSlots, materialOverrides,
    geometry.width, geometry.depth, geometry.origin, width, depth])
  const selectionHalos = useMemo(() => attachEntitySelectionHalo(scene), [scene])
  useModelStateAnimation(scene, animations, modelState)

  useEffect(() => {
    setEntitySelectionHaloVisible(selectionHalos, selected)
  }, [selected, selectionHalos])
  useEffect(() => () => disposeEntitySelectionHalo(selectionHalos), [selectionHalos])

  if (modelState === 'destroyed') return null
  const rotationY = -hatchOrientationQuarterTurns(connector) * Math.PI / 2
  return (
    <group
      position={[Number(connector.x) + width / 2, (Number(connector.y) || 0) + thickness / 2, Number(connector.z) + depth / 2]}
      rotation={[0, rotationY, 0]}
      scale={uniformScale}
      renderOrder={31}
    >
      <primitive object={scene} position={offset} />
    </group>
  )
}

function HatchConnectorSegment({ connector, textureMaterials, opacity, selected }) {
  const panelRef = useRef()
  const appearance = surfaceMaterialAt(connector.material, true)
  const top = appearance?.cutoutMaterial
    || appearance?.faceMaterials[FACE.top]
    || materialAt(textureMaterials, connector.tex, FACE.top)
    || STRUCTURAL_STEEL_MATERIAL
  const solid = appearance?.solidMaterial
    || solidMaterialAt(textureMaterials, connector.tex)
    || STRUCTURAL_STEEL_MATERIAL
  const panelMaterials = withOpacity([solid, solid, top, top, solid, solid], opacity)
  const frameMaterial = withOpacity([solid], opacity)[0]
  const x = Number(connector.x) || 0
  const y = Number(connector.y) || 0
  const z = Number(connector.z) || 0
  const width = Math.max(0.2, Number(connector.width) || 1)
  const depth = Math.max(0.2, Number(connector.depth) || 1)
  const thickness = Math.max(0.04, Number(connector.height) || 0.12)
  const cutout = Boolean(appearance?.cutout || textureMaterials[connector.tex]?.cutout)
  const visualThickness = thinGrateThickness(thickness, cutout)
  const hingeSide = Number(connector.hingeSide) < 0 ? -1 : 1
  const axis = connector.axis === 'z' ? 'z' : 'x'
  const state = connector.runtimeState?.state || connector.state || 'closed'
  const open = state === 'open' || state === 'destroyed'
  const targetAngle = open
    ? axis === 'x' ? hingeSide * Math.PI * 0.56 : -hingeSide * Math.PI * 0.56
    : 0
  const initialAngleRef = useRef(targetAngle)
  const frameSize = Math.min(0.08, Math.max(0.035, Math.min(width, depth) * 0.065))
  const pivotY = cutout ? y + thickness / 2 : y
  const panelY = cutout ? -visualThickness / 2 : 0
  const pivot = axis === 'x'
    ? [x + width / 2, pivotY, z + (hingeSide > 0 ? depth : 0)]
    : [x + (hingeSide > 0 ? width : 0), pivotY, z + depth / 2]
  const panelOffset = axis === 'x'
    ? [0, panelY, hingeSide > 0 ? -depth / 2 : depth / 2]
    : [hingeSide > 0 ? -width / 2 : width / 2, panelY, 0]

  useFrame((_, delta) => {
    if (!panelRef.current) return
    const rotationAxis = axis === 'x' ? 'x' : 'z'
    panelRef.current.rotation[rotationAxis] = THREE.MathUtils.damp(
      panelRef.current.rotation[rotationAxis],
      targetAngle,
      11,
      delta,
    )
  })

  return (
    <group>
      <mesh position={[x + width / 2, y + thickness / 2, z]} material={frameMaterial} castShadow receiveShadow>
        <boxGeometry args={[width + frameSize * 2, frameSize, frameSize]} />
      </mesh>
      <mesh position={[x + width / 2, y + thickness / 2, z + depth]} material={frameMaterial} castShadow receiveShadow>
        <boxGeometry args={[width + frameSize * 2, frameSize, frameSize]} />
      </mesh>
      <mesh position={[x, y + thickness / 2, z + depth / 2]} material={frameMaterial} castShadow receiveShadow>
        <boxGeometry args={[frameSize, frameSize, depth]} />
      </mesh>
      <mesh position={[x + width, y + thickness / 2, z + depth / 2]} material={frameMaterial} castShadow receiveShadow>
        <boxGeometry args={[frameSize, frameSize, depth]} />
      </mesh>
      {state !== 'destroyed' && (
        <group
          ref={panelRef}
          position={pivot}
          rotation={axis === 'x' ? [initialAngleRef.current, 0, 0] : [0, 0, initialAngleRef.current]}
        >
          <mesh
            position={panelOffset}
            material={panelMaterials}
            castShadow
            receiveShadow
            userData={!open ? { worldSupport: true, worldFeatureId: connector.worldId || connector.id } : undefined}
          >
            <boxGeometry args={[width, visualThickness, depth]} />
          </mesh>
        </group>
      )}
      {selected && (
        <mesh position={[x + width / 2, y + thickness / 2 + 0.01, z + depth / 2]} renderOrder={45}>
          <boxGeometry args={[width + 0.08, thickness + 0.08, depth + 0.08]} />
          <meshBasicMaterial color="#fbbf24" wireframe transparent opacity={0.95} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

export function ConnectorSegment({ connector, curveWall = null, textureMaterials = {}, opacity = 1, selected = false, onPointerSelect = null, displayLevel = null }) {
  const handlePointerDown = useCallback((event) => {
    if (!onPointerSelect || !connector?.id) return
    event.stopPropagation()
    event.nativeEvent?.preventDefault?.()
    onPointerSelect(connector.id, connector, event)
  }, [connector, onPointerSelect])

  if (!connector) return null
  const pointerProps = onPointerSelect ? { onPointerDown: handlePointerDown } : {}
  if (['door', 'window', 'screen-window'].includes(connector.type)) {
    const url = connectorAssetUrl(connector)
    if (url) {
      return (
        <group {...pointerProps}>
          <WindowEmbrasure connector={connector} opacity={opacity} />
          <Suspense fallback={<DoorConnectorFallback connector={connector} opacity={opacity} />}>
            <DoorConnectorModel connector={connector} curveWall={curveWall} opacity={opacity} selected={selected} />
          </Suspense>
        </group>
      )
    }
    return (
      <group {...pointerProps}>
        <WindowEmbrasure connector={connector} opacity={opacity} />
        <DoorConnectorFallback connector={connector} opacity={opacity} />
        {selected && <ConnectorSelectionOutline connector={connector} />}
      </group>
    )
  }

  if (connector.type === 'skylight') {
    const url = connectorAssetUrl(connector)
    const width = Math.max(1, Number(connector.width) || 1)
    const depth = Math.max(1, Number(connector.depth) || 1)
    return (
      <group {...pointerProps}>
        {url ? (
          <Suspense fallback={null}><SkylightConnectorModel connector={connector} opacity={opacity} /></Suspense>
        ) : (
          <mesh position={[Number(connector.x) + width / 2, Number(connector.y) || 0, Number(connector.z) + depth / 2]}>
            <boxGeometry args={[width, 0.08, depth]} />
            <meshPhysicalMaterial color="#6edcff" transparent opacity={0.3} roughness={0.12} metalness={0.08} depthWrite={false} />
          </mesh>
        )}
        {selected && <SkylightSelectionOutline connector={connector} />}
      </group>
    )
  }

  if (connector.type === 'hatch') {
    const url = connectorAssetUrl(connector)
    return (
      <group {...pointerProps}>
        {url ? (
          <Suspense fallback={(
            <HatchConnectorSegment
              connector={connector}
              textureMaterials={textureMaterials}
              opacity={opacity}
              selected={selected}
            />
          )}>
            <HatchConnectorModel connector={connector} opacity={opacity} selected={selected} />
          </Suspense>
        ) : (
          <HatchConnectorSegment
            connector={connector}
            textureMaterials={textureMaterials}
            opacity={opacity}
            selected={selected}
          />
        )}
      </group>
    )
  }

  if (connector.type === 'legacy-door-placeholder') {
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
    const height = Math.max(0.5, Number(connector.height) || 2)
    return (
      <mesh position={[x, (Number(connector.y) || 0) + height / 2, z]} renderOrder={30} {...pointerProps}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color="#f97316" transparent opacity={Math.min(0.92, opacity)} depthWrite={opacity >= 0.95} />
      </mesh>
    )
  }

  if (connector.type === 'ladder') {
    const fullY = Number(connector.y) || 0
    const fullTopY = Number(connector.topY) || fullY + STORY_HEIGHT
    const sliceBottom = displayLevel === null ? -Infinity : displayLevel * STORY_HEIGHT
    const sliceTop = displayLevel === null ? Infinity : sliceBottom + STORY_HEIGHT
    const y = Math.max(fullY, sliceBottom)
    let topY = Math.min(fullTopY, sliceTop)
    if (topY <= y && displayLevel !== null && Math.abs(fullTopY - sliceBottom) < 0.01) {
      topY = y + 0.12
    }
    const height = Math.max(0.2, topY - y)
    const width = Math.max(0.2, Number(connector.width) || 0.7)
    const depth = Math.max(0.05, Number(connector.depth) || 0.12)
    const spacing = Math.max(0.1, Number(connector.anchorSpacing) || 0.5)
    const railThickness = Math.min(0.08, Math.max(0.035, width * 0.09))
    const rungCount = Math.min(128, Math.max(2, Math.floor(height / spacing) + 1))
    const centerX = Number(connector.x) + 0.5
    const centerZ = Number(connector.z) + 0.5
    const alongX = connector.axis !== 'z'
    const railGeometry = alongX
      ? [railThickness, height, depth]
      : [depth, height, railThickness]
    const rungGeometry = alongX
      ? [width, railThickness, depth]
      : [depth, railThickness, width]
    const appearance = surfaceMaterialAt(connector.material, true)
    const structureMaterial = withOpacity([
      appearance?.solidMaterial
        || solidMaterialAt(textureMaterials, connector.tex)
        || appearance?.faceMaterials[FACE.south]
        || materialAt(textureMaterials, connector.tex, FACE.south, FACE.top)
        || STRUCTURAL_STEEL_MATERIAL,
    ], opacity)[0]

    return (
      <group renderOrder={30} {...pointerProps}>
        {[-1, 1].map(side => (
          <mesh
            key={`rail-${side}`}
            position={[
              centerX + (alongX ? side * width / 2 : 0),
              y + height / 2,
              centerZ + (alongX ? 0 : side * width / 2),
            ]}
            material={structureMaterial}
            castShadow
            receiveShadow
          >
            <boxGeometry args={railGeometry} />
          </mesh>
        ))}
        {Array.from({ length: rungCount }, (_, index) => {
          const ratio = rungCount === 1 ? 0 : index / (rungCount - 1)
          return (
            <mesh
              key={`rung-${index}`}
              position={[centerX, y + ratio * height, centerZ]}
              material={structureMaterial}
              castShadow
              receiveShadow
              userData={{ worldSupport: true, worldFeatureId: connector.worldId || connector.id }}
            >
              <boxGeometry args={rungGeometry} />
            </mesh>
          )
        })}
        {selected && (
          <mesh position={[centerX, y + height / 2, centerZ]}>
            <boxGeometry args={alongX ? [width + 0.08, height + 0.08, depth + 0.08] : [depth + 0.08, height + 0.08, width + 0.08]} />
            <meshBasicMaterial color="#f97316" wireframe depthTest={false} />
          </mesh>
        )}
      </group>
    )
  }

  if (connector.type === 'elevator') {
    const width = Math.max(0.5, Number(connector.width) || 1)
    const depth = Math.max(0.5, Number(connector.depth) || 1)
    const cabinHeight = Math.max(1, Number(connector.cabinHeight) || Math.min(2.2, STORY_HEIGHT * 0.88))
    const floorThickness = Math.max(0.04, Number(connector.cabinFloorThickness) || 0.12)
    const wallThickness = Math.max(0.04, Number(connector.cabinWallThickness) || 0.08)
    const stops = Array.isArray(connector.stops) && connector.stops.length
      ? connector.stops
      : [
        { id: `level:${connector.fromLevel ?? connector.level ?? 0}`, y: Number(connector.y) || 0 },
        { id: `level:${connector.toLevel ?? ((connector.level ?? 0) + 1)}`, y: Number(connector.topY) || (Number(connector.y) || 0) + STORY_HEIGHT },
      ]
    const runtimeState = connector.runtimeState || {}
    const floorY = Number.isFinite(Number(runtimeState.positionY))
      ? Number(runtimeState.positionY)
      : Number(stops[0]?.y) || Number(connector.y) || 0
    const currentStop = stops.find(stop => stop.id === runtimeState.currentStopId)
    const doorsOpen = runtimeState.phase === 'open'
      && runtimeState.doorState === 'open'
      && currentStop
      && Math.abs(Number(currentStop.y) - floorY) < 0.001
    const x = Number(connector.x) || 0
    const z = Number(connector.z) || 0
    const centerX = x + width / 2
    const centerZ = z + depth / 2
    const fullShaftBottom = Math.min(...stops.map(stop => Number(stop.y) || 0))
    const fullShaftTop = Math.max(...stops.map(stop => Number(stop.y) || 0)) + cabinHeight
    const sliceBottom = displayLevel === null ? fullShaftBottom : displayLevel * STORY_HEIGHT
    const sliceTop = displayLevel === null ? fullShaftTop : sliceBottom + STORY_HEIGHT
    const shaftBottom = Math.max(fullShaftBottom, sliceBottom)
    const shaftTop = Math.min(fullShaftTop, sliceTop)
    const visibleStops = stops.filter(stop => displayLevel === null || yToLevel(stop.y) === displayLevel)
    const cabinDisplayY = elevatorDisplayY(runtimeState, floorY)
    const cabinVisible = displayLevel === null
      || (cabinDisplayY < sliceTop && cabinDisplayY + cabinHeight > sliceBottom)
    const doorAxis = connector.doorAxis === 'x' ? 'x' : 'z'
    const doorSide = Number(connector.doorSide) < 0 ? -1 : 1
    const faces = [
      { axis: 'x', side: -1 }, { axis: 'x', side: 1 },
      { axis: 'z', side: -1 }, { axis: 'z', side: 1 },
    ]
    const faceBox = (face, y) => face.axis === 'x'
      ? {
        position: [face.side < 0 ? x : x + width, y, centerZ],
        args: [wallThickness, cabinHeight, depth],
      }
      : {
        position: [centerX, y, face.side < 0 ? z : z + depth],
        args: [width, cabinHeight, wallThickness],
      }
    return (
      <group renderOrder={30} {...pointerProps}>
        <mesh position={[centerX, shaftBottom + (shaftTop - shaftBottom) / 2, centerZ]}>
          <boxGeometry args={[width + wallThickness * 2, shaftTop - shaftBottom, depth + wallThickness * 2]} />
          <meshBasicMaterial color="#7c3aed" wireframe transparent opacity={Math.min(0.2, opacity * 0.2)} depthWrite={false} />
        </mesh>
        {visibleStops.map(stop => {
          const open = doorsOpen && stop.id === runtimeState.currentStopId
          if (open) return null
          const face = { axis: doorAxis, side: doorSide }
          const box = faceBox(face, Number(stop.y) + cabinHeight / 2)
          return (
            <mesh key={`landing-${stop.id}`} position={box.position}>
              <boxGeometry args={box.args} />
              <meshStandardMaterial color="#475569" transparent opacity={Math.min(0.82, opacity)} />
            </mesh>
          )
        })}
        {cabinVisible && <AnimatedElevatorCabin state={runtimeState} fallbackY={floorY}>
          <mesh position={[centerX, -floorThickness / 2, centerZ]} receiveShadow>
            <boxGeometry args={[width, floorThickness, depth]} />
            <meshStandardMaterial color="#a78bfa" metalness={0.55} roughness={0.38} transparent opacity={Math.min(0.96, opacity)} />
          </mesh>
          <mesh position={[centerX, cabinHeight - floorThickness / 2, centerZ]} castShadow>
            <boxGeometry args={[width, floorThickness, depth]} />
            <meshStandardMaterial color="#64748b" metalness={0.45} roughness={0.45} transparent opacity={Math.min(0.92, opacity)} />
          </mesh>
          {faces.map(face => {
            const isDoor = face.axis === doorAxis && face.side === doorSide
            if (isDoor && doorsOpen) return null
            const box = faceBox(face, cabinHeight / 2)
            return (
              <mesh key={`cabin-${face.axis}-${face.side}`} position={box.position} castShadow>
                <boxGeometry args={box.args} />
                <meshStandardMaterial color={isDoor ? '#8b5cf6' : '#334155'} metalness={0.5} roughness={0.42} transparent opacity={Math.min(isDoor ? 0.9 : 0.72, opacity)} />
              </mesh>
            )
          })}
          {selected && (
            <mesh position={[centerX, cabinHeight / 2, centerZ]} renderOrder={45}>
              <boxGeometry args={[width + 0.1, cabinHeight + 0.1, depth + 0.1]} />
              <meshBasicMaterial color="#fbbf24" wireframe transparent opacity={0.95} depthWrite={false} />
            </mesh>
          )}
        </AnimatedElevatorCabin>}
      </group>
    )
  }

  return null
}

function StairRailBeam({ part, material, selected = false }) {
  const transform = useMemo(() => {
    const from = new THREE.Vector3(part.from.x, part.from.y, part.from.z)
    const to = new THREE.Vector3(part.to.x, part.to.y, part.to.z)
    const direction = to.clone().sub(from)
    const length = Math.max(0.001, direction.length())
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    )
    return {
      position: from.add(to).multiplyScalar(0.5).toArray(),
      quaternion,
      length,
    }
  }, [part])
  return (
    <mesh
      position={transform.position}
      quaternion={transform.quaternion}
      material={material}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[part.thickness, transform.length, part.thickness]} />
      {selected && (
        <mesh scale={1.16} renderOrder={44}>
          <boxGeometry args={[part.thickness, transform.length, part.thickness]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.32} depthWrite={false} />
        </mesh>
      )}
    </mesh>
  )
}

function StairSegment({
  stair,
  textureMaterials,
  opacity = 1,
  showDetails = true,
  selected = false,
  onPointerSelect = null,
}) {
  const procedural = surfaceMaterialAt(stair.material, showDetails)
  const topBase = procedural?.faceMaterials[FACE.top] || materialAt(textureMaterials, stair.tex, FACE.top)
  const top = usesCutoutMaterial(procedural, textureMaterials, stair.tex)
    ? withRepeat(topBase, STAIR_GRATE_TEXTURE_REPEAT, STAIR_GRATE_TEXTURE_REPEAT)
    : topBase
  const side = procedural?.solidMaterial || solidMaterialAt(textureMaterials, stair.tex) || procedural?.faceMaterials[FACE.south] || materialAt(textureMaterials, stair.tex, FACE.south, FACE.top) || top
  const bottom = procedural?.faceMaterials[FACE.bottom] || materialAt(textureMaterials, stair.tex, FACE.bottom, FACE.top) || top
  const relief = showDetails ? (procedural?.relief || reliefAt(textureMaterials, stair.tex)) : null
  const materials = top ? withOpacity([side, side, top, bottom, side, side], opacity) : []
  const geometry = stairGeometry(stair, { storyHeight: STORY_HEIGHT })
  if (!top) return null

  return (
    <group
      onPointerDown={onPointerSelect ? event => {
        event.stopPropagation()
        onPointerSelect(stair.id, { ...stair, type: 'stairs' }, event)
      } : undefined}
    >
      {geometry.steps.map(step => step.polygon ? (
        <group key={step.index}>
          <mesh material={[top, side]} castShadow receiveShadow userData={{ worldSupport: true }}>
            <StairPrismGeometry part={step} splitMaterials />
          </mesh>
          {selected && (
            <mesh renderOrder={43}>
              <StairPrismGeometry part={step} />
              <meshBasicMaterial color="#facc15" wireframe transparent opacity={0.42} depthWrite={false} />
            </mesh>
          )}
        </group>
      ) : (
        <mesh
          key={step.index}
          position={[step.position.x, step.position.y, step.position.z]}
          material={materials}
          castShadow
          receiveShadow
          userData={{ worldSupport: true }}
        >
          <ReliefBoxGeometry
            args={step.size}
            faceProfiles={[null, null, relief, null, null, null]}
            faceMask={[false, false, true, false, false, false]}
          />
          {selected && (
            <mesh scale={[1.025, 1.012, 1.025]} renderOrder={43}>
              <boxGeometry args={step.size} />
              <meshBasicMaterial color="#facc15" transparent opacity={0.2} depthWrite={false} />
            </mesh>
          )}
        </mesh>
      ))}
      {geometry.column && (() => {
        const height = geometry.column.maxY - geometry.column.minY
        return (
          <mesh
            position={[geometry.column.center.x, geometry.column.minY + height / 2, geometry.column.center.z]}
            material={side}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[geometry.column.radius, geometry.column.radius, height, 32]} />
            {selected && (
              <mesh scale={1.035} renderOrder={43}>
                <cylinderGeometry args={[geometry.column.radius, geometry.column.radius, height, 32]} />
                <meshBasicMaterial color="#facc15" transparent opacity={0.25} depthWrite={false} />
              </mesh>
            )}
          </mesh>
        )
      })()}
      {geometry.railParts.map(part => (
        <StairRailBeam
          key={`${part.side}:${part.kind}:${part.index}`}
          part={part}
          material={side}
          selected={selected}
        />
      ))}
    </group>
  )
}

function ExteriorWaterSurface({ surface, opacity = 0.16 }) {
  const material = useMemo(() => createWaterMaterial({ opacity: Math.max(opacity, 0.38) }), [opacity])

  useFrame((state) => updateWaterMaterial(material, state.clock.elapsedTime))

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh
      position={[surface.x + surface.width / 2, surface.y, surface.z + surface.depth / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={20}
    >
      <planeGeometry args={[surface.width, surface.depth, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

function sameStringSet(left, right) {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

function displayedWallFacades(walls, displayLevel, cameraVolumeRoomId = null) {
  if (displayLevel === null) return []
  const groups = new Map()
  for (const wall of walls) {
    const belongsToCameraVolume = cameraVolumeRoomId && wall.roomIds?.includes(cameraVolumeRoomId)
    if (!wallParticipatesInCameraCutaway({
      wallLevel: yToLevel(wallOpacityY(wall)),
      displayLevel,
      belongsToActiveRoomVolume: belongsToCameraVolume,
    })) continue
    const facadeId = wallFacadeKey(wall)
    if (!groups.has(facadeId)) {
      groups.set(facadeId, {
        id: facadeId,
        surfaces: [],
        logicalWallIds: new Set(),
      })
    }
    const group = groups.get(facadeId)
    group.surfaces.push({
      path: profiledWallPath(wall),
      roomIds: wall.roomIds || [],
      interiorNormalSignsByRoom: wall.interiorNormalSignsByRoom || {},
    })
    group.logicalWallIds.add(wall.logicalWallId || wall.id)
  }
  return [...groups.values()]
}

function useOccludedWallIds(walls, displayLevel, cameraVolumeRoomId = null) {
  const { camera } = useThree()
  const facades = useMemo(
    () => displayedWallFacades(walls, displayLevel, cameraVolumeRoomId),
    [cameraVolumeRoomId, displayLevel, walls],
  )
  const [occludedIds, setOccludedIds] = useState(() => new Set())
  const elapsedRef = useRef(0)
  const lastViewRef = useRef(null)
  const inputsRef = useRef({ facades: null, cameraVolumeRoomId: null })

  useFrame((_, delta) => {
    elapsedRef.current += delta
    if (elapsedRef.current < 0.08) return
    elapsedRef.current = 0

    const previous = lastViewRef.current
    const position = camera.position
    const quaternion = camera.quaternion
    const cameraMoved = !previous
      || previous.position.distanceToSquared(position) > 0.0004
      || 1 - Math.abs(previous.quaternion.dot(quaternion)) > 0.00002
    const inputsChanged = inputsRef.current.facades !== facades
      || inputsRef.current.cameraVolumeRoomId !== cameraVolumeRoomId
    if (!cameraMoved && !inputsChanged) return

    lastViewRef.current = {
      position: position.clone(),
      quaternion: quaternion.clone(),
    }
    inputsRef.current = { facades, cameraVolumeRoomId }

    const next = new Set()
    const occludingFacadeIds = cameraFacingFacadeIds({
      camera: camera.position,
      roomId: cameraVolumeRoomId,
      facades,
    })
    for (const facade of facades) {
      if (!occludingFacadeIds.has(facade.id)) continue
      for (const logicalWallId of facade.logicalWallIds) next.add(logicalWallId)
    }
    setOccludedIds(current => (sameStringSet(current, next) ? current : next))
  })

  return occludedIds
}

function RoomFloorSurface({ room, roomLookup, textureMaterials, showDetails, skylights, hatches, stairs }) {
  const hasVerticalProfile = Array.isArray(room?.verticalProfile?.slices)
    && room.verticalProfile.slices.length > 0
  const floorSlice = hasVerticalProfile ? roomSliceAtLevel(room, 0, roomLookup, STORY_HEIGHT) : null
  if (room.floorEnabled === false) return null
  return (
    <RoomSlab
      room={room}
      roomLookup={roomLookup}
      kind="floor"
      textureMaterials={textureMaterials}
      opacity={1}
      showDetails={showDetails}
      footprintContours={floorSlice ? multiPolygonContours(floorSlice.footprint) : null}
      footprint={floorSlice?.footprint || roomBoundaryMultiPolygon(room, roomLookup)}
      skylights={skylights}
      hatches={hatches}
      stairs={stairs}
    />
  )
}

function RoomCeilingInterface({ horizontalInterface, room, roomLookup, textureMaterials, opacity, showDetails, skylights, hatches, stairs }) {
  return (
    <RoomSlab
      room={room}
      roomLookup={roomLookup}
      kind="ceiling"
      textureMaterials={textureMaterials}
      opacity={opacity}
      showDetails={showDetails}
      footprintContours={multiPolygonContours(horizontalInterface.footprint)}
      footprint={horizontalInterface.footprint}
      yOverride={horizontalInterface.y}
      skylights={skylights}
      hatches={hatches}
      stairs={stairs}
    />
  )
}

function SurfaceDungeonScene({
  surfaceData,
  textureMaterials,
  showWater = true,
  waterOpacity = 0.16,
  ceilingOpacity = 0.18,
  displayLevel = null,
  showDetails = true,
  selectedConnectorId = null,
  onConnectorSelect = null,
  runtimeFeatureStates = {},
  cameraControlsRef = null,
  roomContextAnchor = null,
  onCameraRoomIdChange = null,
}) {
  const surface = useMemo(() => normalizeSurfaceData(surfaceData), [surfaceData])
  const skylights = useMemo(
    () => Object.values(surface.connectors).filter(connector => connector?.type === 'skylight'),
    [surface.connectors],
  )
  const hatches = useMemo(
    () => Object.values(surface.connectors).filter(connector => connector?.type === 'hatch'),
    [surface.connectors],
  )
  const stairs = useMemo(() => Object.values(surface.stairs), [surface.stairs])
  const cameraVolumeRoomId = useCameraRoomId(surface, displayLevel, cameraControlsRef, roomContextAnchor)
  useEffect(() => {
    onCameraRoomIdChange?.(cameraVolumeRoomId)
  }, [cameraVolumeRoomId, onCameraRoomIdChange])
  const horizontalInterfaces = useMemo(
    () => roomHorizontalInterfaces(surface.rooms, STORY_HEIGHT),
    [surface.rooms],
  )
  const water = useMemo(
    () => (showWater ? computeSurfaceWaterCells(surface) : null),
    [showWater, surface],
  )
  const roomWallPaths = useMemo(
    () => roomsWallRenderPaths(surface.rooms),
    [surface.rooms],
  )
  const roomWallSegments = useMemo(
    () => cutWallsForDoorConnectors(roomWallPaths, surface.connectors),
    [roomWallPaths, surface.connectors],
  )
  const curveWallsById = useMemo(
    () => new Map(roomWallPaths.filter(wall => wall.axis === 'arc' && wall.curveId).map(wall => [wall.curveId, wall])),
    [roomWallPaths],
  )
  const surfaceWallSegments = useMemo(
    () => cutWallsForDoorConnectors(
      Object.entries(surface.walls).map(([id, wall]) => ({ ...wall, id: wall?.id || id })),
      surface.connectors,
    ),
    [surface.walls, surface.connectors],
  )
  const allWallSegments = useMemo(
    () => [...roomWallSegments, ...surfaceWallSegments],
    [roomWallSegments, surfaceWallSegments],
  )
  const occludedWallIds = useOccludedWallIds(allWallSegments, displayLevel, cameraVolumeRoomId)
  const structureIsVisible = (y) => displayLevel === null || yToLevel(y) <= displayLevel
  const worldPointIsVisible = (x, z, y) => (
    isWorldPointVisibleAtLevel(surface, displayLevel, x, z, y, cameraVolumeRoomId)
  )
  const worldInteriorPointIsVisible = (x, z, y) => (
    isWorldInteriorPointVisibleAtLevel(surface, displayLevel, x, z, y, cameraVolumeRoomId)
  )
  const roomWallIsVisible = wall => structureIsVisible(wallOpacityY(wall))
    || (cameraVolumeRoomId && wall.roomIds?.includes(cameraVolumeRoomId))
  const connectorIsVisible = connector => {
    if (displayLevel === null) return true
    if (cameraVolumeRoomId && connector?.roomIds?.includes(cameraVolumeRoomId)) return true
    if (['door', 'window', 'screen-window', 'legacy-door-placeholder'].includes(connector?.type)) {
      const centerX = Number.isFinite(Number(connector?.x))
        ? Number(connector.x)
        : ((Number(connector?.x0) || 0) + (Number(connector?.x1) || 0)) / (2 * SURFACE_FINE)
      const centerZ = Number.isFinite(Number(connector?.z))
        ? Number(connector.z)
        : ((Number(connector?.z0) || 0) + (Number(connector?.z1) || 0)) / (2 * SURFACE_FINE)
      return worldPointIsVisible(centerX, centerZ, connector?.y)
    }
    const levels = []
    if (Array.isArray(connector?.stops)) {
      levels.push(...connector.stops.map(stop => yToLevel(stop?.y)))
    }
    if (Number.isFinite(Number(connector?.fromLevel))) levels.push(Number(connector.fromLevel))
    if (Number.isFinite(Number(connector?.toLevel))) levels.push(Number(connector.toLevel))
    if (Number.isFinite(Number(connector?.y))) levels.push(yToLevel(connector.y))
    if (Number.isFinite(Number(connector?.topY))) levels.push(yToLevel(connector.topY))
    if (levels.length === 0) return false
    if (displayLevel >= Math.min(...levels) && displayLevel <= Math.max(...levels)) return true
    const centerX = (Number(connector?.x) || 0) + (Number(connector?.width) || 1) / 2
    const centerZ = (Number(connector?.z) || 0) + (Number(connector?.depth) || 1) / 2
    const heights = [
      connector?.y,
      connector?.topY,
      connector?.fromY,
      connector?.toY,
      ...(connector?.stops || []).map(stop => stop?.y),
    ].filter(value => Number.isFinite(Number(value)))
    return heights.some(y => worldInteriorPointIsVisible(centerX, centerZ, Number(y)))
  }
  const renderedFloorRoomIds = new Set()

  return (
    <>
      {horizontalInterfaces.map(horizontalInterface => {
        const floorRoom = horizontalInterface.floorRoomId
          ? surface.rooms[horizontalInterface.floorRoomId]
          : null
        const ceilingRoom = horizontalInterface.ceilingRoomId
          ? surface.rooms[horizontalInterface.ceilingRoomId]
          : null
        const floorBelongsToCameraVolume = horizontalInterface.floorRoomId === cameraVolumeRoomId
        const ceilingBelongsToCameraVolume = horizontalInterface.ceilingRoomId === cameraVolumeRoomId
        const renderKind = horizontalInterfaceRenderKind({
          hasFloor: Boolean(floorRoom),
          floorDisplayLevel: floorRoom ? yToLevel(getRoomBaseY(floorRoom)) : null,
          floorBelongsToCameraVolume,
          hasCeiling: Boolean(ceilingRoom),
          ceilingDisplayLevel: horizontalInterface.ceilingDisplayLevel,
          interfaceDisplayLevel: yToLevel(horizontalInterface.y),
          ceilingBelongsToCameraVolume,
          displayLevel,
        })
        const room = renderKind === 'floor' ? floorRoom : ceilingRoom
        if (!renderKind || !room) return null
        if (renderKind === 'floor') {
          const roomId = horizontalInterface.floorRoomId
          if (renderedFloorRoomIds.has(roomId)) return null
          renderedFloorRoomIds.add(roomId)
          return (
            <RoomFloorSurface
              key={`floor:${roomId}`}
              room={{ id: roomId, ...room }}
              roomLookup={surface.rooms}
              textureMaterials={textureMaterials}
              showDetails={showDetails}
              skylights={skylights}
              hatches={hatches}
              stairs={stairs}
            />
          )
        }
        const opacity = horizontalInterfaceOpacity({
          displayLevel,
          ceilingDisplayLevel: horizontalInterface.ceilingDisplayLevel,
          belongsToCameraVolume: ceilingBelongsToCameraVolume,
          ceilingOpacity,
        })
        return (
          <RoomCeilingInterface
            key={horizontalInterface.id}
            horizontalInterface={horizontalInterface}
            room={{ id: horizontalInterface.ceilingRoomId, ...room }}
            roomLookup={surface.rooms}
            textureMaterials={textureMaterials}
            opacity={opacity}
            showDetails={showDetails}
            skylights={skylights}
            hatches={hatches}
            stairs={stairs}
          />
        )
      })}
      {roomWallSegments.map(wall => roomWallIsVisible(wall) ? (
        <WallSegment
          key={wall.id}
          wall={wall}
          textureMaterials={textureMaterials}
          opacity={occludedWallIds.has(wall.logicalWallId || wall.id) ? OCCLUDED_WALL_OPACITY : 1}
          showDetails={showDetails}
        />
      ) : null)}
      {Object.entries(surface.floors).map(([id, floor]) => {
        const parsed = parseFloorKey(id, floor)
        if ([...skylights, ...hatches].some(connector => Math.abs(Number(connector.y) - parsed.y) < 0.01
          && parsed.x + 0.5 > Number(connector.x) && parsed.x + 0.5 < Number(connector.x) + Number(connector.width || 1)
          && parsed.z + 0.5 > Number(connector.z) && parsed.z + 0.5 < Number(connector.z) + Number(connector.depth || 1))) return null
        if (!worldInteriorPointIsVisible(parsed.x + 0.5, parsed.z + 0.5, parsed.y)) return null
        return <FloorTile key={id} id={id} floor={floor} surface={surface} textureMaterials={textureMaterials} opacity={1} showDetails={showDetails} />
      })}
      {surfaceWallSegments.map(wall => {
        const box = getWallRenderBox(wall)
        const visible = structureIsVisible(wallOpacityY(wall))
          || (box && worldPointIsVisible(box.position[0], box.position[2], wallOpacityY(wall)))
        return visible ? (
          <WallSegment
            key={wall.id}
            wall={wall}
            textureMaterials={textureMaterials}
            opacity={occludedWallIds.has(wall.logicalWallId || wall.id) ? OCCLUDED_WALL_OPACITY : 1}
            showDetails={showDetails}
          />
        ) : null
      })}
      {Object.entries(surface.ceilings).map(([id, ceiling]) => {
        const parsed = parseCeilingKey(id, ceiling)
        if ([...skylights, ...hatches].some(connector => Math.abs(Number(connector.y) - parsed.y) < 0.01
          && parsed.x + 0.5 > Number(connector.x) && parsed.x + 0.5 < Number(connector.x) + Number(connector.width || 1)
          && parsed.z + 0.5 > Number(connector.z) && parsed.z + 0.5 < Number(connector.z) + Number(connector.depth || 1))) return null
        if (!worldInteriorPointIsVisible(parsed.x + 0.5, parsed.z + 0.5, parsed.baseY)) return null
        const opacity = ceilingOpacity
        return (
          <CeilingTile
            key={id}
            id={id}
            ceiling={ceiling}
            textureMaterials={textureMaterials}
            opacity={opacity}
            showDetails={showDetails}
          />
        )
      })}
      {Object.entries(surface.stairs).map(([id, stair]) => {
        const fromLevel = yToLevel(stair?.y)
        const toLevel = yToLevel(stair?.topY)
        const geometry = stairGeometry(stair, { storyHeight: surface.storyHeight })
        const centerX = (geometry.footprint.minX + geometry.footprint.maxX) / 2
        const centerZ = (geometry.footprint.minZ + geometry.footprint.maxZ) / 2
        const visible = displayLevel === null
          || (displayLevel >= Math.min(fromLevel, toLevel) && displayLevel <= Math.max(fromLevel, toLevel))
          || worldInteriorPointIsVisible(
            centerX,
            centerZ,
            stair?.y,
          )
          || worldInteriorPointIsVisible(
            centerX,
            centerZ,
            stair?.topY,
          )
        return visible ? (
          <StairSegment
            key={id}
            stair={{ id, ...stair }}
            textureMaterials={textureMaterials}
            opacity={1}
            showDetails={showDetails}
            selected={id === selectedConnectorId || stair?.id === selectedConnectorId}
            onPointerSelect={onConnectorSelect}
          />
        ) : null
      })}
      {Object.entries(surface.connectors).map(([id, connector]) => connectorIsVisible(connector) ? (
        <ConnectorSegment
          key={id}
          connector={{
            id,
            ...connector,
            runtimeState: runtimeFeatureStates[connector?.worldId || id] || null,
          }}
          curveWall={connector?.curveId ? curveWallsById.get(connector.curveId) || null : null}
          textureMaterials={textureMaterials}
          opacity={1}
          selected={id === selectedConnectorId || connector?.id === selectedConnectorId}
          onPointerSelect={onConnectorSelect}
          displayLevel={displayLevel}
        />
      ) : null)}
      {showWater && water?.exteriorSurface && (
        <ExteriorWaterSurface surface={water.exteriorSurface} opacity={waterOpacity} />
      )}
    </>
  )
}

export default memo(SurfaceDungeonScene)
