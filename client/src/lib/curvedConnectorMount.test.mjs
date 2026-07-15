import test from 'node:test'
import assert from 'node:assert/strict'

import { arcSurfaceMountFrame } from './curvedConnectorMount.js'

test('un boîtier déporté est replacé exactement sur le cercle et sa tangente', () => {
  const radius = 7.785
  const x = 0.885
  const frame = arcSurfaceMountFrame(radius, x, 1)

  assert.ok(frame)
  assert.ok(Math.abs(Math.hypot(x, frame.normalOffset - radius) - radius) < 1e-10)
  const expectedSlope = x / Math.sqrt(radius * radius - x * x)
  assert.ok(Math.abs(-Math.tan(frame.rotationY) - expectedSlope) < 1e-10)
  assert.ok(frame.normalOffset > 0.05 && frame.normalOffset < 0.052)
})

test('la face concave opposée produit le repère miroir', () => {
  const positive = arcSurfaceMountFrame(8, 1, 1)
  const negative = arcSurfaceMountFrame(8, 1, -1)

  assert.equal(negative.normalOffset, -positive.normalOffset)
  assert.equal(negative.rotationY, -positive.rotationY)
})

test('un déport extérieur au rayon est refusé', () => {
  assert.equal(arcSurfaceMountFrame(1, 1, 1), null)
})
