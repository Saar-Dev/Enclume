import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

function polygonArea(points) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    return sum + point.x * next.z - next.x * point.z
  }, 0) / 2
}

function createStairPrismBufferGeometry({ polygon, minY, maxY }, splitMaterials = false) {
  const source = (polygon || [])
    .map(point => ({ x: Number(point.x), z: Number(point.z) }))
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.z))
  if (source.length < 3) return new THREE.BufferGeometry()
  const points = polygonArea(source) >= 0 ? source : [...source].reverse()
  const bottomY = Number(minY) || 0
  const topY = Number.isFinite(Number(maxY)) ? Number(maxY) : bottomY
  const positions = []
  const uvs = []
  const indices = []

  const topOffset = positions.length / 3
  for (const point of points) {
    positions.push(point.x, topY, point.z)
    uvs.push(point.x, point.z)
  }
  const bottomOffset = positions.length / 3
  for (const point of points) {
    positions.push(point.x, bottomY, point.z)
    uvs.push(point.x, point.z)
  }

  const contour = points.map(point => new THREE.Vector2(point.x, point.z))
  const topIndexStart = indices.length
  const triangles = THREE.ShapeUtils.triangulateShape(contour, [])
  for (const triangle of triangles) {
    const [a, b, c] = triangle
    // Dans le plan XZ, l'ordre trigonométrique pointe vers -Y : on inverse le dessus.
    indices.push(topOffset + a, topOffset + c, topOffset + b)
  }
  const topIndexCount = indices.length - topIndexStart
  for (const triangle of triangles) {
    const [a, b, c] = triangle
    indices.push(bottomOffset + a, bottomOffset + b, bottomOffset + c)
  }

  for (let index = 0; index < points.length; index += 1) {
    const from = points[index]
    const to = points[(index + 1) % points.length]
    const sideOffset = positions.length / 3
    const length = Math.hypot(to.x - from.x, to.z - from.z)
    positions.push(
      from.x, bottomY, from.z,
      from.x, topY, from.z,
      to.x, topY, to.z,
      to.x, bottomY, to.z,
    )
    uvs.push(0, bottomY, 0, topY, length, topY, length, bottomY)
    indices.push(
      sideOffset, sideOffset + 1, sideOffset + 2,
      sideOffset, sideOffset + 2, sideOffset + 3,
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  if (splitMaterials) {
    geometry.clearGroups()
    geometry.addGroup(topIndexStart, topIndexCount, 0)
    geometry.addGroup(topIndexStart + topIndexCount, indices.length - topIndexCount, 1)
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export default function StairPrismGeometry({ part, splitMaterials = false }) {
  const geometry = useMemo(() => createStairPrismBufferGeometry(part, splitMaterials), [part, splitMaterials])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <primitive object={geometry} attach="geometry" />
}
