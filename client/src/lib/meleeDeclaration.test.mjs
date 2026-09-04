import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MELEE_DECLARATION_INITIAL as INIT,
  meleeDeclarationReducer as reduce,
  meleeTargetsFilled,
  meleeCheckInputs,
} from './meleeDeclaration.js'

test('état initial : arme auto (undefined), pas d\'arme naturelle', () => {
  assert.equal(INIT.weaponId, undefined)
  assert.equal(INIT.naturalWeaponId, null)
  assert.deepEqual(INIT.targets, [])
  assert.equal(INIT.count, 1)
  assert.equal(INIT.isDualWield, false)
})

test('SELECT_WEAPON : pose l\'arme, efface l\'arme naturelle, garde la config', () => {
  const s = reduce(
    { ...INIT, naturalWeaponId: 'm1', count: 3, targets: ['a', 'b', 'c'], isDualWield: true },
    { type: 'SELECT_WEAPON', weaponId: 'w1' },
  )
  assert.equal(s.weaponId, 'w1')
  assert.equal(s.naturalWeaponId, null)
  assert.equal(s.count, 3)                 // config préservée (≠ Tir)
  assert.deepEqual(s.targets, ['a', 'b', 'c'])
  assert.equal(s.isDualWield, true)
})

test('SELECT_WEAPON null : mains nues explicite', () => {
  assert.equal(reduce({ ...INIT, weaponId: 'w1' }, { type: 'SELECT_WEAPON', weaponId: null }).weaponId, null)
})

test('SELECT_NATURAL : pose l\'arme naturelle, efface l\'arme d\'inventaire', () => {
  const s = reduce({ ...INIT, weaponId: 'w1' }, { type: 'SELECT_NATURAL', id: 'm1' })
  assert.equal(s.naturalWeaponId, 'm1')
  assert.equal(s.weaponId, null)
})

test('SET_COUNT : troncature seule (pas de remplissage — cibles distinctes par défaut)', () => {
  assert.deepEqual(reduce({ ...INIT, targets: ['a', 'b', 'c'] }, { type: 'SET_COUNT', count: 2 }).targets, ['a', 'b'])
  assert.deepEqual(reduce({ ...INIT, targets: ['a'] }, { type: 'SET_COUNT', count: 3 }).targets, ['a'])
})

test('SET_TARGET : pose un seul slot', () => {
  let s = reduce({ ...INIT, targets: ['a', 'b'] }, { type: 'SET_TARGET', index: 1, tokenId: 'x' })
  assert.deepEqual(s.targets, ['a', 'x'])
  s = reduce(s, { type: 'SET_TARGET', index: 0, tokenId: 'y' })
  assert.deepEqual(s.targets, ['y', 'x'])
})

test('SET_SOLE_TARGET / RESET_TARGETS', () => {
  assert.deepEqual(reduce({ ...INIT, targets: ['a', 'b'] }, { type: 'SET_SOLE_TARGET', tokenId: 'z' }).targets, ['z'])
  assert.deepEqual(reduce({ ...INIT, targets: ['a', 'b'] }, { type: 'RESET_TARGETS' }).targets, [])
})

test('SET_DUAL_WIELD', () => {
  assert.equal(reduce(INIT, { type: 'SET_DUAL_WIELD', value: true }).isDualWield, true)
})

test('SET_CHARGE : pose { move, targetTokenId } ou efface (null)', () => {
  const ch = { move: { targetPosX: 3, targetPosY: 4, ini_mod: 0 }, targetTokenId: 'e1' }
  const s = reduce(INIT, { type: 'SET_CHARGE', charge: ch })
  assert.deepEqual(s.charge, ch)
  assert.equal(reduce(s, { type: 'SET_CHARGE', charge: null }).charge, null)
  assert.equal(reduce(s, { type: 'SET_CHARGE' }).charge, null)
})

test('CLEAR : retour à l\'état initial (arme auto, charge effacée)', () => {
  const dirty = { weaponId: 'w1', naturalWeaponId: null, targets: ['a', 'b'], count: 2, isDualWield: true, charge: { move: {}, targetTokenId: 'x' } }
  assert.deepEqual(reduce(dirty, { type: 'CLEAR' }), INIT)
})

test('action inconnue : identité', () => {
  const s = { ...INIT, count: 2 }
  assert.equal(reduce(s, { type: 'NOPE' }), s)
})

test('meleeTargetsFilled : compte les cibles non nulles', () => {
  assert.equal(meleeTargetsFilled({ ...INIT, targets: ['a', null, 'c'] }), 2)
  assert.equal(meleeTargetsFilled(INIT), 0)
})

// --- meleeCheckInputs (PLAN_RW_DECLARE_DERIVATION Étape B) ---------------------------------------

const mctx = (over = {}) => ({ started: true, defensif: false, effectiveMeleeCount: 1, ...over })

test('meleeCheckInputs : CaC simple — targetsFilled = targets.length, pas de Charge', () => {
  assert.deepEqual(meleeCheckInputs({ ...INIT, targets: ['e1', 'e2'] }, mctx({ effectiveMeleeCount: 2 })), {
    started: true, defensif: false, isCharge: false, chargeHasMove: false, chargeHasTarget: false,
    targetsFilled: 2, targetsNeeded: 2,
  })
})

test('meleeCheckInputs : started / defensif passés tels quels', () => {
  const r = meleeCheckInputs(INIT, mctx({ started: false, defensif: true }))
  assert.equal(r.started, false)
  assert.equal(r.defensif, true)
})

test('meleeCheckInputs : Charge avec déplacement seul (cible pas encore posée)', () => {
  const state = { ...INIT, charge: { move: { targetPosX: 1 }, targetTokenId: null } }
  const r = meleeCheckInputs(state, mctx())
  assert.equal(r.isCharge, true)
  assert.equal(r.chargeHasMove, true)
  assert.equal(r.chargeHasTarget, false)
})

test('meleeCheckInputs : Charge complète', () => {
  const state = { ...INIT, charge: { move: { targetPosX: 1 }, targetTokenId: 'e1' } }
  const r = meleeCheckInputs(state, mctx())
  assert.equal(r.chargeHasMove, true)
  assert.equal(r.chargeHasTarget, true)
})

test('meleeCheckInputs : charge null → isCharge false, pas de crash sur ?.', () => {
  const r = meleeCheckInputs({ ...INIT, charge: null }, mctx())
  assert.equal(r.isCharge, false)
  assert.equal(r.chargeHasMove, false)
  assert.equal(r.chargeHasTarget, false)
})
