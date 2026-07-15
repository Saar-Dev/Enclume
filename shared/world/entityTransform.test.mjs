import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ENTITY_SCALE_MAX,
  ENTITY_SCALE_MIN,
  normalizeEntityScale,
  withEntityScale,
} from './entityTransform.js'

test('l échelle uniforme d une entité est bornée et rétrocompatible', () => {
  assert.equal(normalizeEntityScale({ transform: { scale: 1.35 } }), 1.35)
  assert.equal(normalizeEntityScale({ scale: 2 }), 2)
  assert.equal(normalizeEntityScale({ transform: { scale: 0 } }), ENTITY_SCALE_MIN)
  assert.equal(normalizeEntityScale({ transform: { scale: 99 } }), ENTITY_SCALE_MAX)
  assert.equal(normalizeEntityScale({ transform: { scale: 'invalide' } }), 1)
})

test('modifier l échelle conserve les autres états de l instance', () => {
  assert.deepEqual(withEntityScale({
    open: true,
    transform: { locked: false },
  }, 1.75), {
    open: true,
    transform: { locked: false, scale: 1.75 },
  })
})
