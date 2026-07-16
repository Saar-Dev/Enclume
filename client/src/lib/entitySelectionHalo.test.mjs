import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  attachEntitySelectionHalo,
  disposeEntitySelectionHalo,
  setEntitySelectionHaloVisible,
} from './entitySelectionHalo.js'

test('le halo suit la géométrie réelle et sa hiérarchie orientée', () => {
  const root = new THREE.Group()
  const pivot = new THREE.Group()
  pivot.rotation.y = Math.PI / 2
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.25), new THREE.MeshBasicMaterial())
  mesh.position.set(0.4, 0.5, -0.2)
  pivot.add(mesh)
  root.add(pivot)

  const halos = attachEntitySelectionHalo(root)
  assert.equal(halos.length, 2)
  assert.equal(halos[0].parent, mesh)
  assert.equal(halos[0].geometry, mesh.geometry)
  assert.equal(halos[0].visible, false)
  setEntitySelectionHaloVisible(halos, true)
  assert.equal(halos.every(halo => halo.visible), true)
  disposeEntitySelectionHalo(halos)
  assert.equal(mesh.children.length, 0)
})
