import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'

import { entitySelectionBounds } from './entitySelectionBounds.js'

test('le halo suit les vraies bornes locales d un GLB orienté', () => {
  const root = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4))
  mesh.position.set(1, 0.5, -2)
  mesh.rotation.y = Math.PI / 2
  root.add(mesh)

  const bounds = entitySelectionBounds(root, { width: 9, height: 9, depth: 9 })

  assert.deepEqual(bounds.center.map(value => Math.round(value * 1e6) / 1e6), [1, 0.5, -2])
  assert.deepEqual(bounds.size.map(value => Math.round(value * 1e6) / 1e6), [4, 1, 2])
})

test('le halo vide utilise les dimensions de secours du blueprint', () => {
  assert.deepEqual(entitySelectionBounds(new THREE.Group(), {
    width: 3,
    height: 2,
    depth: 1,
  }), {
    center: [0, 1, 0],
    size: [3, 2, 1],
  })
})
