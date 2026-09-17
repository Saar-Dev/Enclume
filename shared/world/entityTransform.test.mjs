import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ENTITY_SCALE_MAX,
  ENTITY_SCALE_MIN,
  normalizeEntityScale,
  normalizeInteractionOverrides,
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

const BLUEPRINT_INTERACTIONS = [{ id: 'move' }, { id: 'open' }]

test('normalizeInteractionOverrides garde une surcharge valide sur une interaction connue', () => {
  assert.deepEqual(
    normalizeInteractionOverrides({ move: { difficulty_dc: 5, range: 2.5 } }, BLUEPRINT_INTERACTIONS),
    { move: { difficulty_dc: 5, range: 2.5 } },
  )
})

test('normalizeInteractionOverrides rejette un id d interaction absent du blueprint', () => {
  assert.deepEqual(
    normalizeInteractionOverrides({ inexistant: { difficulty_dc: 5 } }, BLUEPRINT_INTERACTIONS),
    {},
  )
})

test('normalizeInteractionOverrides écarte une difficulté non finie plutôt que de la persister', () => {
  assert.deepEqual(
    normalizeInteractionOverrides({ move: { difficulty_dc: 'difficile' } }, BLUEPRINT_INTERACTIONS),
    {},
  )
  assert.deepEqual(
    normalizeInteractionOverrides({ move: { difficulty_dc: NaN } }, BLUEPRINT_INTERACTIONS),
    {},
  )
})

test('normalizeInteractionOverrides accepte une difficulté négative (malus) mais rejette une portée négative ou nulle', () => {
  assert.deepEqual(
    normalizeInteractionOverrides({ move: { difficulty_dc: -3, range: 0 } }, BLUEPRINT_INTERACTIONS),
    { move: { difficulty_dc: -3 } },
  )
})

test('normalizeInteractionOverrides retourne un objet vide sans blueprint fourni', () => {
  assert.deepEqual(normalizeInteractionOverrides({ move: { difficulty_dc: 5 } }), {})
  assert.deepEqual(normalizeInteractionOverrides(null, BLUEPRINT_INTERACTIONS), {})
})
