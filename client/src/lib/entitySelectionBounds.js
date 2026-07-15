import * as THREE from 'three'

export function entitySelectionBounds(object, fallback = {}) {
  const fallbackWidth = Math.max(0.05, Number(fallback.width) || 1)
  const fallbackHeight = Math.max(0.05, Number(fallback.height) || 1)
  const fallbackDepth = Math.max(0.05, Number(fallback.depth) || 1)
  if (!object) {
    return {
      center: [0, fallbackHeight / 2, 0],
      size: [fallbackWidth, fallbackHeight, fallbackDepth],
    }
  }

  object.updateWorldMatrix(true, true)
  const bounds = new THREE.Box3().setFromObject(object, true)
  if (bounds.isEmpty()) {
    return {
      center: [0, fallbackHeight / 2, 0],
      size: [fallbackWidth, fallbackHeight, fallbackDepth],
    }
  }

  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  bounds.getCenter(center)
  bounds.getSize(size)
  return {
    center: [center.x, center.y, center.z],
    size: [size.x, size.y, size.z],
  }
}
