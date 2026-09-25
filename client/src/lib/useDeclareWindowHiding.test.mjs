import test from 'node:test'
import assert from 'node:assert/strict'

import { isDeclareWindowHidden, EXPLICIT_MOVE_PENDING } from './useDeclareWindowHiding.js'

const base = { tokenIds: ['t1'], combatMoveMode: null, pendingMoveSelection: null, combatTargetMode: null, combatAoeTargetMode: null }

test('rien en cours → visible', () => {
  assert.equal(isDeclareWindowHidden(base), false)
})

test('ciblage Attaque/CaC de son token → masquée ; d’un autre token → visible', () => {
  assert.equal(isDeclareWindowHidden({ ...base, combatTargetMode: { tokenId: 't1' } }), true)
  assert.equal(isDeclareWindowHidden({ ...base, combatTargetMode: { tokenId: 't2' } }), false)
})

test('visée de zone de son token → masquée', () => {
  assert.equal(isDeclareWindowHidden({ ...base, combatAoeTargetMode: { tokenId: 't1' } }), true)
})

test('pilote : le drone télépiloté compte comme « son » token', () => {
  const ids = ['t1', 'drone1']
  assert.equal(isDeclareWindowHidden({ ...base, tokenIds: ids, combatTargetMode: { tokenId: 'drone1' } }), true)
  assert.equal(isDeclareWindowHidden({ ...base, tokenIds: ids, combatAoeTargetMode: { tokenId: 'drone1' } }), true)
})

test('survol ambiant seul → visible ; destination posée → masquée', () => {
  const mode = { tokenId: 't1' }
  assert.equal(isDeclareWindowHidden({ ...base, combatMoveMode: mode }), false)
  assert.equal(isDeclareWindowHidden({ ...base, combatMoveMode: mode, pendingMoveSelection: { targetPosX: 1 } }), true)
})

test('destination en attente d’un AUTRE token → visible', () => {
  assert.equal(isDeclareWindowHidden({ ...base, combatMoveMode: { tokenId: 't2' }, pendingMoveSelection: {} }), false)
})

test('sélection explicite (tuile Déplacement, Retraite, Charge) → masquée dès le mode armé', () => {
  const mode = { tokenId: 't1' }
  assert.equal(isDeclareWindowHidden({ ...base, combatMoveMode: mode, explicitMove: mode }), true)
  assert.equal(isDeclareWindowHidden({ ...base, combatMoveMode: mode, explicitMove: EXPLICIT_MOVE_PENDING }), true)
})

test('marqueur explicite périmé (nouveau mode ambiant après validation) → visible', () => {
  const old = { tokenId: 't1' }
  assert.equal(isDeclareWindowHidden({ ...base, combatMoveMode: { tokenId: 't1' }, explicitMove: old }), false)
})

test('marqueur explicite sans mode de déplacement (annulé) → visible', () => {
  assert.equal(isDeclareWindowHidden({ ...base, explicitMove: EXPLICIT_MOVE_PENDING }), false)
})

test('holdHidden force le masquage (enchaînement de cibles MJ)', () => {
  assert.equal(isDeclareWindowHidden({ ...base, holdHidden: true }), true)
})

test('identifiants nuls ignorés : un mode sans tokenId ne masque pas un token sans id', () => {
  assert.equal(isDeclareWindowHidden({ ...base, tokenIds: [null], combatTargetMode: { tokenId: undefined } }), false)
})
