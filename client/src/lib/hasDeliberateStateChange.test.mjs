import test from 'node:test'
import assert from 'node:assert/strict'

import { hasDeliberateStateChange } from './hasDeliberateStateChange.js'

const initial = { position: 'standing', weapon: 'holstered', fire_mode: 'cc', cover: 'exposed', vitesse: 'normal' }
const declFrom = (over = {}) => ({ ...initial, combatMode: 'normal', quick: {}, ...over })

test('decl identique à initial → false', () => {
  assert.equal(hasDeliberateStateChange(declFrom(), initial), false)
})

test('changement de posture → true', () => {
  assert.equal(hasDeliberateStateChange(declFrom({ position: 'crouching' }), initial), true)
})

test('changement d\'arme → true (y compris auto-dégaine, cf. bug pré-existant documenté)', () => {
  assert.equal(hasDeliberateStateChange(declFrom({ weapon: 'drawn' }), initial), true)
})

test('changement de vitesse → true', () => {
  assert.equal(hasDeliberateStateChange(declFrom({ vitesse: 'rushed' }), initial), true)
})

test('changement de mode de tir → true (sélecteur ARMEMENT, coût INI dédié)', () => {
  assert.equal(hasDeliberateStateChange(declFrom({ fire_mode: 'rl' }), initial), true)
})

test('cover seul modifié → false (exclu : aucun sélecteur)', () => {
  assert.equal(hasDeliberateStateChange(declFrom({ cover: 'important' }), initial), false)
})

test('combatMode seul modifié → false (exclu : modificateur, pas action)', () => {
  assert.equal(hasDeliberateStateChange(declFrom({ combatMode: 'offensif' }), initial), false)
})

test('decl ou initial absent → false (jamais de lever)', () => {
  assert.equal(hasDeliberateStateChange(null, initial), false)
  assert.equal(hasDeliberateStateChange(declFrom(), null), false)
  assert.equal(hasDeliberateStateChange(undefined, undefined), false)
})
