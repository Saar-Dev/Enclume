import * as THREE from 'three'

const HALO_TAG = 'entitySelectionHalo'

function haloMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
}

export function attachEntitySelectionHalo(root) {
  if (!root) return []
  const meshes = []
  root.traverse(object => {
    if (object.isMesh && !object.userData?.[HALO_TAG]) meshes.push(object)
  })
  const halos = []
  for (const mesh of meshes) {
    if (!mesh.geometry || mesh.isSkinnedMesh) continue
    const close = new THREE.Mesh(mesh.geometry, haloMaterial('#ffd34d', 0.58))
    close.name = `${mesh.name || 'mesh'}__selection-halo-close`
    close.scale.setScalar(1.035)
    close.renderOrder = 1000
    close.raycast = () => null
    close.visible = false
    close.userData[HALO_TAG] = true
    close.selectionHaloOwner = mesh
    const aura = new THREE.Mesh(mesh.geometry, haloMaterial('#ffb300', 0.16))
    aura.name = `${mesh.name || 'mesh'}__selection-halo-aura`
    aura.scale.setScalar(1.1)
    aura.renderOrder = 999
    aura.raycast = () => null
    aura.visible = false
    aura.userData[HALO_TAG] = true
    aura.selectionHaloOwner = mesh
    mesh.add(close, aura)
    halos.push(close, aura)
  }
  return halos
}

export function setEntitySelectionHaloVisible(halos, visible) {
  for (const halo of halos || []) {
    if (!halo.parent && halo.selectionHaloOwner) halo.selectionHaloOwner.add(halo)
    halo.visible = Boolean(visible)
  }
}

export function disposeEntitySelectionHalo(halos) {
  for (const halo of halos || []) {
    halo.removeFromParent()
    delete halo.selectionHaloOwner
    halo.material?.dispose?.()
  }
}
