import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { createWaterMaterial, updateWaterMaterial } from '../lib/waterMaterials'
import ReliefBoxGeometry from './ReliefBoxGeometry.jsx'
import { generateProceduralMaterialTexture } from '../lib/proceduralMaterials.js'
import { applyMaterialSlotOverrides, normalizeModelMaterialSlots } from '../lib/modelMaterialSlots.js'
import { roomBoundaryContours } from '../../../shared/world/roomGeometry.js'
import {
  SURFACE_FINE,
  STORY_HEIGHT,
  computeSurfaceWaterCells,
  getCeilingThickness,
  getFloorThickness,
  getRoomBaseY,
  getRoomCeilingThickness,
  getRoomFloorThickness,
  getRoomFootprintCells,
  getRoomHeightLevels,
  getRoomTopY,
  getWallRenderBox,
  isWorldPointVisibleAtLevel,
  normalizeSurfaceData,
  parseCeilingKey,
  parseFloorKey,
  roomFootprintRectangles,
  roomsWallSegments,
  stairStepBoxes,
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

function makeDataTexture(dataUrl, color = true) {
  const texture = new THREE.TextureLoader().load(dataUrl)
  texture.colorSpace = color ? THREE.SRGBColorSpace : (THREE.NoColorSpace || '')
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

function pbrForProcedural(materialId) {
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

  const generated = generateProceduralMaterialTexture({ ...descriptor, size: 128 })
  const map = makeDataTexture(generated.albedoDataUrl, true)
  const normalMap = makeDataTexture(generated.normalDataUrl, false)
  const pbr = pbrForProcedural(generated.material?.id)
  const reliefStrength = Math.max(0, Math.min(1, Number(descriptor.relief) / 100 || 0))
  const material = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.8 + reliefStrength * 0.7, 0.8 + reliefStrength * 0.7),
    color: 0xffffff,
    roughness: pbr.roughness,
    metalness: pbr.metalness,
  })
  const entry = {
    faceMaterials: [material, material, material, material, material, material],
    relief: generated.procedural,
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

function FloorTile({ id, floor, textureMaterials, opacity = 1, showDetails = true }) {
  const { x, z, y } = parseFloorKey(id, floor)
  const topProcedural = surfaceMaterialAt(floor.topMaterial || floor.material, showDetails)
  const bottomProcedural = surfaceMaterialAt(floor.bottomMaterial || floor.material, showDetails)
  const topTex = floor.topTex || floor.tex
  const bottomTex = floor.bottomTex || floor.tex || topTex
  const top = topProcedural?.faceMaterials[FACE.top] || materialAt(textureMaterials, topTex, FACE.top)
  const side = topProcedural?.faceMaterials[FACE.south] || materialAt(textureMaterials, topTex, FACE.south, FACE.top) || top
  const bottom = bottomProcedural?.faceMaterials[FACE.bottom]
    || materialAt(textureMaterials, bottomTex, FACE.bottom, FACE.top)
    || top
  const topRelief = showDetails ? (topProcedural?.relief || reliefAt(textureMaterials, topTex)) : null
  const thickness = getFloorThickness(floor)
  const materials = top ? withOpacity([side, side, top, bottom, side, side], opacity) : []
  if (!top) return null
  return (
    <>
      <mesh
        position={[x + 0.5, y, z + 0.5]}
        material={materials}
        castShadow
        receiveShadow
        userData={{ worldSupport: true }}
      >
        <ReliefBoxGeometry
          args={[1, thickness, 1]}
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
  const side = topProcedural?.faceMaterials[FACE.south] || materialAt(textureMaterials, topTex, FACE.south, FACE.top) || bottom
  const relief = showDetails ? (bottomProcedural?.relief || reliefAt(textureMaterials, bottomTex)) : null
  const thickness = getCeilingThickness(ceiling)
  const materials = withOpacity([side, side, top, bottom, side, side], opacity)
  return (
    <mesh position={[x + 0.5, y, z + 0.5]} material={materials} castShadow receiveShadow>
      <ReliefBoxGeometry
        args={[1, thickness, 1]}
        faceProfiles={[null, null, null, relief, null, null]}
        faceMask={[false, false, false, true, false, false]}
      />
    </mesh>
  )
}

function RoomSlab({ room, roomLookup, kind, textureMaterials, opacity = 1, showDetails = true }) {
  const rectangles = roomFootprintRectangles(room)
  const isCeiling = kind === 'ceiling'
  const y = isCeiling ? getRoomTopY(room) : getRoomBaseY(room)
  const thickness = isCeiling ? getRoomCeilingThickness(room) : getRoomFloorThickness(room)
  const topMaterialDescriptor = isCeiling ? room.ceilingTopMaterial : room.floorTopMaterial
  const bottomMaterialDescriptor = isCeiling ? room.ceilingBottomMaterial : room.floorBottomMaterial
  const topTex = isCeiling ? room.ceilingTopTex : room.floorTopTex
  const bottomTex = isCeiling ? room.ceilingBottomTex : room.floorBottomTex
  const topProcedural = surfaceMaterialAt(topMaterialDescriptor, showDetails)
  const bottomProcedural = surfaceMaterialAt(bottomMaterialDescriptor, showDetails)
  const top = topProcedural?.faceMaterials[FACE.top] || materialAt(textureMaterials, topTex, FACE.top)
  const bottom = bottomProcedural?.faceMaterials[FACE.bottom]
    || materialAt(textureMaterials, bottomTex, FACE.bottom, FACE.top)
    || top
  const side = topProcedural?.faceMaterials[FACE.south] || materialAt(textureMaterials, topTex, FACE.south, FACE.top) || top
  const relief = showDetails ? (topProcedural?.relief || reliefAt(textureMaterials, topTex)) : null
  if (!top) return null

  const hasCurvedBoundary = (Array.isArray(room.boundaryArcs) && room.boundaryArcs.length > 0)
    || (Array.isArray(room.geometryClipRoomIds) && room.geometryClipRoomIds.length > 0)
  if (hasCurvedBoundary) {
    return (
      <CurvedRoomSlab
        room={room}
        roomLookup={roomLookup}
        kind={kind}
        y={y}
        thickness={thickness}
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
        const minY = y - thickness / 2
        const maxY = y + thickness / 2
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
            position={[minX + rectangle.width / 2, y, minZ + rectangle.depth / 2]}
            material={materials}
            castShadow
            receiveShadow
            userData={isCeiling ? undefined : { worldSupport: true }}
          >
            <ReliefBoxGeometry
              args={[rectangle.width, thickness, rectangle.depth]}
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

function CurvedRoomSlab({ room, roomLookup, kind, y, thickness, capMaterial, sideMaterial, opacity }) {
  const isCeiling = kind === 'ceiling'
  const geometries = useMemo(() => shapesFromRoomContours(
    roomBoundaryContours(room, roomLookup),
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
  }), [room, roomLookup, thickness])

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

function WallSegment({ wall, textureMaterials, opacity = 1, showDetails = true }) {
  const frontProcedural = surfaceMaterialAt(wall.frontMaterial || wall.material, showDetails)
  const backProcedural = surfaceMaterialAt(wall.backMaterial || wall.frontMaterial || wall.material, showDetails)
  const frontRelief = showDetails ? (frontProcedural?.relief || reliefAt(textureMaterials, wall.frontTex)) : null
  const backRelief = showDetails ? (backProcedural?.relief || reliefAt(textureMaterials, wall.backTex)) : null
  const box = getWallRenderBox(wall)
  const [width, height, depth] = box?.args || [1, 1, 1]
  const frontBase = frontProcedural?.faceMaterials[FACE.south] || materialAt(textureMaterials, wall.frontTex, FACE.south)
  const backBase = backProcedural?.faceMaterials[FACE.north] || materialAt(textureMaterials, wall.backTex, FACE.north, FACE.south) || frontBase
  const topBase = frontProcedural?.faceMaterials[FACE.top] || materialAt(textureMaterials, wall.topTex || wall.frontTex, FACE.top, FACE.south) || frontBase
  const [cx, cy, cz] = box?.position || [0, 0, 0]
  const minX = cx - width / 2
  const maxX = cx + width / 2
  const minY = cy - height / 2
  const maxY = cy + height / 2
  const minZ = cz - depth / 2
  const maxZ = cz + depth / 2
  const faceUvTransforms = faceUvTransformsForBox(minX, minY, minZ, maxX, maxY, maxZ)
  const faceUvScales = faceUvScalesFromTransforms(faceUvTransforms)
  const faceUvOffsets = faceUvOffsetsFromTransforms(faceUvTransforms)

  let materials = []
  let faceProfiles
  let faceMask
  if (wall.axis === 'x' || wall.axis === 'segment') {
    const sideEast = withUvTransform(frontBase, faceUvTransforms[0])
    const sideWest = withUvTransform(frontBase, faceUvTransforms[1])
    const top = withUvTransform(topBase, faceUvTransforms[2])
    const bottom = withUvTransform(topBase, faceUvTransforms[3])
    const front = withUvTransform(frontBase, faceUvTransforms[4])
    const back = withUvTransform(backBase, faceUvTransforms[5])
    materials = [sideEast, sideWest, top, bottom, front, back]
    faceProfiles = [null, null, null, null, frontRelief, backRelief]
    faceMask = [false, false, false, false, true, true]
  } else {
    const front = withUvTransform(frontBase, faceUvTransforms[0])
    const back = withUvTransform(backBase, faceUvTransforms[1])
    const top = withUvTransform(topBase, faceUvTransforms[2])
    const bottom = withUvTransform(topBase, faceUvTransforms[3])
    const sideSouth = withUvTransform(frontBase, faceUvTransforms[4])
    const sideNorth = withUvTransform(frontBase, faceUvTransforms[5])
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
          args={box.args}
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
          box={box}
          frontDescriptor={wall.frontMaterial || wall.material || frontRelief}
          backDescriptor={wall.backMaterial || wall.frontMaterial || wall.material || backRelief}
        />
      )}
    </>
  )
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function cloneWallPiece(wall, suffix, patch) {
  return {
    ...wall,
    ...patch,
    id: `${wall.id}:cut:${suffix}`,
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
  if (!connector || connector.type !== 'door' || !wall || connector.axis !== wall.axis) return null
  const connectorLevel = Number.isFinite(Number(connector.level))
    ? Math.trunc(Number(connector.level))
    : yToLevel(connector.y)
  const wallLevel = yToLevel(wallOpacityY(wall))
  if (connectorLevel !== wallLevel) return null

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

  const modelGeometry = connector.modelGeometry || {}
  const openingInterval = doorOpeningInterval(connector, connectorCenterWorld)
  const cutMin = openingInterval.min * fine
  const cutMax = openingInterval.max * fine
  const adjustedMin = Math.max(wallMin, cutMin)
  const adjustedMax = Math.min(wallMax, cutMax)
  if (adjustedMax <= adjustedMin + 0.01) return null

  const wallBottom = Number(wall.y) || 0
  const wallHeight = Math.max(0.5, Number(wall.height) || STORY_HEIGHT)
  const wallTop = wallBottom + wallHeight
  const doorBottom = Number(connector.y) || wallBottom
  const modelHeight = Number(modelGeometry.height) || Number(connector.height) || 2
  const doorTop = clampValue(doorBottom + Math.max(0.5, modelHeight), wallBottom, wallTop)
  if (doorTop <= wallBottom + 0.01) return null

  return {
    min: adjustedMin,
    max: adjustedMax,
    bottom: wallBottom,
    top: doorTop,
    wallTop,
  }
}

function splitWallForDoorConnector(wall, connector) {
  const opening = doorOpeningForConnector(connector, wall)
  if (!opening) return [wall]

  const alongStart = wall.axis === 'x' ? Number(wall.x0) : Number(wall.z0)
  const alongEnd = wall.axis === 'x' ? Number(wall.x1) : Number(wall.z1)
  const wallMin = Math.min(alongStart, alongEnd)
  const wallMax = Math.max(alongStart, alongEnd)
  const pieces = []
  const epsilon = 0.01
  const segmentPatch = (start, end) => (
    wall.axis === 'x'
      ? { x0: start, x1: end }
      : { z0: start, z1: end }
  )

  if (opening.min > wallMin + epsilon) {
    pieces.push(cloneWallPiece(wall, `before:${opening.min}`, {
      ...segmentPatch(wallMin, opening.min),
      capEnd: false,
    }))
  }
  if (opening.max < wallMax - epsilon) {
    pieces.push(cloneWallPiece(wall, `after:${opening.max}`, {
      ...segmentPatch(opening.max, wallMax),
      capStart: false,
    }))
  }
  if (opening.wallTop > opening.top + epsilon && opening.max > opening.min + epsilon) {
    pieces.push(cloneWallPiece(wall, `top:${opening.min}:${opening.max}`, {
      ...segmentPatch(opening.min, opening.max),
      capStart: false,
      capEnd: false,
      opacityY: opening.bottom,
      y: opening.top,
      height: opening.wallTop - opening.top,
    }))
  }

  return pieces
}

// Co-localise avec les helpers geometriques prives utilises pour decouper les murs.
// eslint-disable-next-line react-refresh/only-export-components
export function cutWallsForDoorConnectors(walls, connectors) {
  const doors = Object.values(connectors || {}).filter(connector => connector?.type === 'door')
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
  const alongLength = Math.max(
    0.2,
    geometryWidth || Number(connector.width) || (connector.axis === 'x' ? Math.abs(x1 - x0) : Math.abs(z1 - z0)),
  )
  const modelDepth = Math.max(0.05, geometryDepth || Number(connector.depth) || wallDepth)
  const fallbackDepth = Math.max(wallDepth, modelDepth)
  const width = connector.axis === 'x' ? alongLength : fallbackDepth
  const depth = connector.axis === 'z' ? alongLength : fallbackDepth
  const x = connector.axis === 'x' ? (x0 + x1) / 2 : x0
  const z = connector.axis === 'z' ? (z0 + z1) / 2 : z0
  const height = Math.max(0.5, Number(modelGeometry.height) || Number(connector.height) || 2)
  return {
    position: [x, (Number(connector.y) || 0) + height / 2, z],
    floorPosition: [x, Number(connector.y) || 0, z],
    args: [width, height, depth],
    alongLength,
    modelDepth,
    fallbackDepth,
    wallDepth,
    rotationY: connector.axis === 'z' ? Math.PI / 2 : 0,
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
    <mesh position={box.position} renderOrder={30}>
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

function DoorConnectorModel({ connector, opacity = 1 }) {
  const url = connectorAssetUrl(connector)
  const box = connectorDoorBox(connector)
  const materialSlots = useMemo(
    () => normalizeModelMaterialSlots(connector?.modelGeometry),
    [connector?.modelGeometry],
  )
  const materialOverrides = connector?.modelMaterialOverrides || connector?.materialOverrides || null
  const preserveAuthoredOrigin = connector?.modelGeometry?.origin === 'floor-center' || Boolean(connector?.modelBuiltinKey)
  const { scene: sourceScene } = useGLTF(url)
  const { scene, size, offset } = useMemo(() => {
    const clone = SkeletonUtils.clone(sourceScene)
    clone.traverse((child) => {
      if (!child.isMesh || !child.material) return
      child.castShadow = true
      child.receiveShadow = true
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      const cloned = materials.map(material => {
        const next = applyMaterialSlotOverrides(material.clone(), materialSlots, materialOverrides)
        next.transparent = opacity < 0.999 || next.transparent
        next.opacity = Math.min(next.opacity ?? 1, opacity)
        next.depthWrite = opacity >= 0.999
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
    return {
      scene: clone,
      size: modelSize,
      offset: modelOffset,
    }
  }, [sourceScene, opacity, preserveAuthoredOrigin, materialSlots, materialOverrides])

  if (!url || !box || !scene) return null
  const geometry = connector.modelGeometry || {}
  const modelWidth = Math.max(0.01, size.x || Number(geometry.width) || Number(connector.width) || box.alongLength || 1)
  const modelHeight = Math.max(0.01, size.y || Number(geometry.height) || Number(connector.height) || 2)
  const targetWidth = Math.max(0.05, Number(geometry.width) || Number(connector.width) || box.alongLength)
  const targetHeight = Math.max(0.5, Number(connector.height) || Number(geometry.height) || 2)
  const uniformScale = Number.isFinite(targetHeight) && modelHeight > 0.01
    ? targetHeight / modelHeight
    : targetWidth / modelWidth

  return (
    <group position={box.floorPosition} rotation={[0, box.rotationY, 0]} scale={uniformScale} renderOrder={31}>
      <primitive object={scene} position={offset} />
    </group>
  )
}

function ConnectorSegment({ connector, opacity = 1, selected = false, onPointerSelect = null, displayLevel = null }) {
  const handlePointerDown = useCallback((event) => {
    if (!onPointerSelect || !connector?.id) return
    event.stopPropagation()
    event.nativeEvent?.preventDefault?.()
    onPointerSelect(connector.id, connector, event)
  }, [connector, onPointerSelect])

  if (!connector) return null
  const pointerProps = onPointerSelect ? { onPointerDown: handlePointerDown } : {}
  if (connector.type === 'door') {
    const url = connectorAssetUrl(connector)
    if (url) {
      return (
        <group {...pointerProps}>
          <Suspense fallback={<DoorConnectorFallback connector={connector} opacity={opacity} />}>
            <DoorConnectorModel connector={connector} opacity={opacity} />
          </Suspense>
          {selected && <ConnectorSelectionOutline connector={connector} />}
        </group>
      )
    }
    return (
      <group {...pointerProps}>
        <DoorConnectorFallback connector={connector} opacity={opacity} />
        {selected && <ConnectorSelectionOutline connector={connector} />}
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
            castShadow
          >
            <boxGeometry args={railGeometry} />
            <meshStandardMaterial color="#94a3b8" transparent opacity={Math.min(0.95, opacity)} />
          </mesh>
        ))}
        {Array.from({ length: rungCount }, (_, index) => {
          const ratio = rungCount === 1 ? 0 : index / (rungCount - 1)
          return (
            <mesh
              key={`rung-${index}`}
              position={[centerX, y + ratio * height, centerZ]}
              castShadow
              userData={{ worldSupport: true, worldFeatureId: connector.worldId || connector.id }}
            >
              <boxGeometry args={rungGeometry} />
              <meshStandardMaterial color="#cbd5e1" transparent opacity={Math.min(0.95, opacity)} />
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

function StairSegment({ stair, textureMaterials, opacity = 1, showDetails = true }) {
  const procedural = surfaceMaterialAt(stair.material, showDetails)
  const top = procedural?.faceMaterials[FACE.top] || materialAt(textureMaterials, stair.tex, FACE.top)
  const side = procedural?.faceMaterials[FACE.south] || materialAt(textureMaterials, stair.tex, FACE.south, FACE.top) || top
  const bottom = procedural?.faceMaterials[FACE.bottom] || materialAt(textureMaterials, stair.tex, FACE.bottom, FACE.top) || top
  const relief = showDetails ? (procedural?.relief || reliefAt(textureMaterials, stair.tex)) : null
  const materials = top ? withOpacity([side, side, top, bottom, side, side], opacity) : []
  if (!top) return null

  return (
    <>
      {stairStepBoxes(stair).map((step, index) => (
        <mesh
          key={index}
          position={step.position}
          material={materials}
          castShadow
          receiveShadow
          userData={{ worldSupport: true }}
        >
          <ReliefBoxGeometry
            args={step.args}
            faceProfiles={[null, null, relief, null, null, null]}
            faceMask={[false, false, true, false, false, false]}
          />
        </mesh>
      ))}
    </>
  )
}

function mergeWaterCells(waterCells) {
  const groups = new Map()
  for (const cell of waterCells) {
    const key = `${Math.round(cell.baseY * 1000)}:${Math.round(cell.topY * 1000)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(cell)
  }

  const rectangles = []
  for (const cells of groups.values()) {
    const cellMap = new Map(cells.map(cell => [`${cell.x}:${cell.z}`, cell]))
    const used = new Set()
    const sorted = [...cells].sort((a, b) => a.z - b.z || a.x - b.x)

    for (const cell of sorted) {
      const startKey = `${cell.x}:${cell.z}`
      if (used.has(startKey)) continue

      let width = 1
      while (cellMap.has(`${cell.x + width}:${cell.z}`) && !used.has(`${cell.x + width}:${cell.z}`)) {
        width += 1
      }

      let depth = 1
      let canExtend = true
      while (canExtend) {
        const nextZ = cell.z + depth
        for (let dx = 0; dx < width; dx += 1) {
          const key = `${cell.x + dx}:${nextZ}`
          if (!cellMap.has(key) || used.has(key)) {
            canExtend = false
            break
          }
        }
        if (canExtend) depth += 1
      }

      for (let dz = 0; dz < depth; dz += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          used.add(`${cell.x + dx}:${cell.z + dz}`)
        }
      }

      rectangles.push({
        x: cell.x,
        z: cell.z,
        width,
        depth,
        baseY: cell.baseY,
        topY: cell.topY,
      })
    }
  }

  return rectangles
}

function WaterSheets({ waterCells, opacity = 0.16 }) {
  const rectangles = useMemo(() => mergeWaterCells(waterCells), [waterCells])
  const material = useMemo(() => createWaterMaterial({ opacity: Math.max(opacity, 0.38) }), [opacity])

  useFrame((state) => updateWaterMaterial(material, state.clock.elapsedTime))

  useEffect(() => () => material.dispose(), [material])

  return (
    <>
      {rectangles.map((rect, index) => {
        return (
          <mesh
            key={`${rect.baseY}:${rect.topY}:${rect.x}:${rect.z}:${index}`}
            position={[rect.x + rect.width / 2, rect.topY - 0.02, rect.z + rect.depth / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={20}
          >
            <planeGeometry args={[rect.width, rect.depth, 16, 16]} />
            <primitive object={material} attach="material" />
          </mesh>
        )
      })}
    </>
  )
}

function displayedFloorCells(surface, displayLevel) {
  const cells = new Set()
  if (displayLevel === null) return cells

  for (const room of Object.values(surface.rooms || {})) {
    if (room?.floorEnabled === false || yToLevel(getRoomBaseY(room)) !== displayLevel) continue
    for (const cell of getRoomFootprintCells(room)) cells.add(`${cell.x}:${cell.z}`)
  }

  for (const [id, floor] of Object.entries(surface.floors || {})) {
    const parsed = parseFloorKey(id, floor)
    if (yToLevel(parsed.y) === displayLevel) cells.add(`${parsed.x}:${parsed.z}`)
  }
  return cells
}

function sameStringSet(left, right) {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

function wallOccludesDisplayedFloor(wall, camera, floorCells, displayLevel) {
  if (!wall || wall.axis === 'segment' || displayLevel === null || yToLevel(wallOpacityY(wall)) !== displayLevel) return false
  const box = getWallRenderBox(wall)
  if (!box || floorCells.size === 0) return false

  const [width, , depth] = box.args
  const [cx, , cz] = box.position
  const alongX = wall.axis === 'x'
  const length = alongX ? width : depth
  const wallLine = alongX ? cz : cx
  const cameraPerpendicular = alongX ? camera.position.z : camera.position.x
  const cameraSide = Math.sign(cameraPerpendicular - wallLine)
  if (cameraSide === 0) return false

  // Un mur masque le sol quand une case du niveau affiche se trouve juste
  // derriere lui, sur le cote oppose a la camera. Ce test topologique reste
  // stable quel que soit l'angle ou le zoom, contrairement a quelques rayons
  // projetes depuis des points arbitraires du mur.
  const halfThickness = (alongX ? depth : width) / 2
  const behindWall = wallLine - cameraSide * (halfThickness + 0.03)
  const sampleCount = Math.max(1, Math.ceil(length * 4))
  const alongStart = (alongX ? cx : cz) - length / 2

  for (let index = 0; index < sampleCount; index += 1) {
    const along = alongStart + ((index + 0.5) / sampleCount) * length
    const floorX = alongX ? along : behindWall
    const floorZ = alongX ? behindWall : along
    if (floorCells.has(`${Math.floor(floorX)}:${Math.floor(floorZ)}`)) return true
  }
  return false
}

function useOccludedWallIds(walls, surface, displayLevel) {
  const { camera } = useThree()
  const floorCells = useMemo(() => displayedFloorCells(surface, displayLevel), [displayLevel, surface])
  const [occludedIds, setOccludedIds] = useState(() => new Set())
  const elapsedRef = useRef(0)
  const lastViewRef = useRef(null)
  const inputsRef = useRef({ walls: null, floorCells: null, displayLevel: null })

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
    const inputsChanged = inputsRef.current.walls !== walls
      || inputsRef.current.floorCells !== floorCells
      || inputsRef.current.displayLevel !== displayLevel
    if (!cameraMoved && !inputsChanged) return

    lastViewRef.current = {
      position: position.clone(),
      quaternion: quaternion.clone(),
    }
    inputsRef.current = { walls, floorCells, displayLevel }

    const next = new Set()
    for (const wall of walls) {
      if (wallOccludesDisplayedFloor(wall, camera, floorCells, displayLevel)) next.add(wall.id)
    }
    setOccludedIds(current => (sameStringSet(current, next) ? current : next))
  })

  return occludedIds
}

function RoomVolume({ room, roomLookup, textureMaterials, ceilingOpacity, showFloor, showCeiling, showDetails }) {
  return (
    <>
      {showFloor && room.floorEnabled !== false && (
        <RoomSlab
          room={room}
          roomLookup={roomLookup}
          kind="floor"
          textureMaterials={textureMaterials}
          opacity={1}
          showDetails={showDetails}
        />
      )}
      {showCeiling && room.ceilingEnabled !== false && (
        <RoomSlab
          room={room}
          roomLookup={roomLookup}
          kind="ceiling"
          textureMaterials={textureMaterials}
          opacity={ceilingOpacity}
          showDetails={showDetails}
        />
      )}
    </>
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
}) {
  const surface = useMemo(() => normalizeSurfaceData(surfaceData), [surfaceData])
  const water = useMemo(
    () => (showWater ? computeSurfaceWaterCells(surface) : null),
    [showWater, surface],
  )
  const roomWallSegments = useMemo(
    () => cutWallsForDoorConnectors(roomsWallSegments(surface.rooms), surface.connectors),
    [surface.rooms, surface.connectors],
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
  const occludedWallIds = useOccludedWallIds(allWallSegments, surface, displayLevel)
  const structureIsVisible = (y) => displayLevel === null || yToLevel(y) === displayLevel
  const worldPointIsVisible = (x, z, y) => (
    isWorldPointVisibleAtLevel(surface, displayLevel, x, z, y)
  )
  const roomDepthIncludesLevel = (room, itemLevel) => {
    if (!room || displayLevel === null || getRoomHeightLevels(room) < 2) return false
    const baseLevel = yToLevel(getRoomBaseY(room))
    const topLevel = baseLevel + getRoomHeightLevels(room) - 1
    return itemLevel >= baseLevel && itemLevel <= displayLevel && displayLevel <= topLevel
  }
  const roomWallIsVisible = wall => structureIsVisible(wallOpacityY(wall))
    || (wall?.roomIds || []).some(roomId => (
      roomDepthIncludesLevel(surface.rooms[roomId], yToLevel(wallOpacityY(wall)))
    ))
  const roomSlice = room => {
    const baseLevel = yToLevel(getRoomBaseY(room))
    const topLevel = baseLevel + getRoomHeightLevels(room) - 1
    return displayLevel === null || (displayLevel >= baseLevel && displayLevel <= topLevel)
  }
  const connectorIsVisible = connector => {
    if (displayLevel === null) return true
    if (connector?.type === 'door' || connector?.type === 'legacy-door-placeholder') {
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
    return displayLevel >= Math.min(...levels) && displayLevel <= Math.max(...levels)
  }
  const visibleWaterCells = useMemo(
    () => water?.waterCells || [],
    [water?.waterCells],
  )

  return (
    <>
      {Object.entries(surface.rooms).map(([id, room]) => {
        if (!roomSlice(room)) return null
        const baseLevel = yToLevel(getRoomBaseY(room))
        const topLevel = baseLevel + getRoomHeightLevels(room) - 1
        return (
          <RoomVolume
            key={id}
            room={{ id, ...room }}
            roomLookup={surface.rooms}
            textureMaterials={textureMaterials}
            ceilingOpacity={ceilingOpacity}
            showFloor
            showCeiling={displayLevel === null || displayLevel === topLevel}
            showDetails={showDetails}
          />
        )
      })}
      {roomWallSegments.map(wall => roomWallIsVisible(wall) ? (
        <WallSegment
          key={wall.id}
          wall={wall}
          textureMaterials={textureMaterials}
          opacity={occludedWallIds.has(wall.id) ? OCCLUDED_WALL_OPACITY : 1}
          showDetails={showDetails}
        />
      ) : null)}
      {Object.entries(surface.floors).map(([id, floor]) => {
        const parsed = parseFloorKey(id, floor)
        if (!worldPointIsVisible(parsed.x + 0.5, parsed.z + 0.5, parsed.y)) return null
        return <FloorTile key={id} id={id} floor={floor} textureMaterials={textureMaterials} opacity={1} showDetails={showDetails} />
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
            opacity={occludedWallIds.has(wall.id) ? OCCLUDED_WALL_OPACITY : 1}
            showDetails={showDetails}
          />
        ) : null
      })}
      {Object.entries(surface.ceilings).map(([id, ceiling]) => {
        const parsed = parseCeilingKey(id, ceiling)
        if (!worldPointIsVisible(parsed.x + 0.5, parsed.z + 0.5, parsed.baseY)) return null
        return (
          <CeilingTile
            key={id}
            id={id}
            ceiling={ceiling}
            textureMaterials={textureMaterials}
            opacity={ceilingOpacity}
            showDetails={showDetails}
          />
        )
      })}
      {Object.entries(surface.stairs).map(([id, stair]) => {
        const fromLevel = yToLevel(stair?.y)
        const toLevel = yToLevel(stair?.topY)
        const visible = displayLevel === null
          || (displayLevel >= Math.min(fromLevel, toLevel) && displayLevel <= Math.max(fromLevel, toLevel))
          || worldPointIsVisible(
            (Number(stair?.minX) + Number(stair?.maxX) + 1) / 2,
            (Number(stair?.minZ) + Number(stair?.maxZ) + 1) / 2,
            stair?.y,
          )
        return visible ? (
        <StairSegment key={id} stair={stair} textureMaterials={textureMaterials} opacity={1} showDetails={showDetails} />
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
          opacity={1}
          selected={id === selectedConnectorId || connector?.id === selectedConnectorId}
          onPointerSelect={onConnectorSelect}
          displayLevel={displayLevel}
        />
      ) : null)}
      {showWater && visibleWaterCells.length > 0 && <WaterSheets waterCells={visibleWaterCells} opacity={waterOpacity} />}
    </>
  )
}

export default memo(SurfaceDungeonScene)
