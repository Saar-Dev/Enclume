import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ASSAULT_DECLARATION_INITIAL as INIT,
  assaultDeclarationReducer as reduce,
  effectiveAssaultCount,
  assaultTargetsFilled,
  assaultTargetsComplete,
} from './assaultDeclaration.js'

// --- reducer : champs simples ---------------------------------------------------------------------

test('SET_* : chaque champ de config est posé sans toucher les autres', () => {
  let s = INIT
  s = reduce(s, { type: 'SET_BULLET_COUNT', value: 3 })
  s = reduce(s, { type: 'SET_VARIANT_AB', value: 'B' })
  s = reduce(s, { type: 'SET_DUAL_WIELD', value: true })
  s = reduce(s, { type: 'SET_AIM_TRANCHES', value: 2 })
  s = reduce(s, { type: 'SET_AIMED_LOCATION', value: 'torso' })
  assert.deepEqual(s, { ...INIT, bulletCount: 3, variantAB: 'B', isDualWield: true, aimTranches: 2, aimedLocation: 'torso' })
})

test('action inconnue : état renvoyé tel quel', () => {
  const s = { ...INIT, aimTranches: 4 }
  assert.equal(reduce(s, { type: 'NOPE' }), s)
})

// --- SELECT_WEAPON : reset de la config (P8 / PO-M4-e) --------------------------------------------

test('SELECT_WEAPON : repart d\'une config vierge avec la nouvelle arme', () => {
  const dirty = {
    weaponId: 'w1', targets: ['t1', 't1'], count: 2, bulletCount: 3,
    variantAB: 'B', isDualWield: true, aimTranches: 3, aimedLocation: 'head',
  }
  assert.deepEqual(
    reduce(dirty, { type: 'SELECT_WEAPON', weaponId: 'w2' }),
    { ...INIT, weaponId: 'w2' },
  )
})

test('SELECT_WEAPON avec null : arme primaire résolue par slots, config vierge', () => {
  assert.deepEqual(
    reduce({ ...INIT, weaponId: 'w1', aimTranches: 2 }, { type: 'SELECT_WEAPON', weaponId: null }),
    INIT,
  )
})

// --- SET_TARGET : 1er clic remplit la série, clics suivants ciblent un slot -----------------------

test('SET_TARGET : aucune cible posée → le 1er choix remplit toute la série', () => {
  const s = reduce({ ...INIT, count: 3 }, { type: 'SET_TARGET', index: 0, tokenId: 'a', seriesLength: 3 })
  assert.deepEqual(s.targets, ['a', 'a', 'a'])
})

test('SET_TARGET : une cible déjà posée → seul le slot visé change', () => {
  let s = reduce({ ...INIT, count: 3 }, { type: 'SET_TARGET', index: 0, tokenId: 'a', seriesLength: 3 })
  s = reduce(s, { type: 'SET_TARGET', index: 1, tokenId: 'b', seriesLength: 3 })
  assert.deepEqual(s.targets, ['a', 'b', 'a'])
})

test('SET_TARGET : seriesLength invalide → au moins un slot', () => {
  const s = reduce(INIT, { type: 'SET_TARGET', index: 0, tokenId: 'a', seriesLength: 0 })
  assert.deepEqual(s.targets, ['a'])
})

// --- SET_COUNT : redimensionne les cibles (défaut « toute la série sur la même cible ») -----------

test('SET_COUNT : agrandir remplit les nouveaux slots avec la 1re cible posée', () => {
  let s = reduce({ ...INIT, count: 1, targets: ['a'] }, { type: 'SET_COUNT', count: 3 })
  assert.equal(s.count, 3)
  assert.deepEqual(s.targets, ['a', 'a', 'a'])
})

test('SET_COUNT : réduire tronque', () => {
  const s = reduce({ ...INIT, count: 3, targets: ['a', 'b', 'c'] }, { type: 'SET_COUNT', count: 2 })
  assert.deepEqual(s.targets, ['a', 'b'])
})

test('SET_COUNT : agrandir sans cible posée → slots null', () => {
  const s = reduce({ ...INIT, targets: [] }, { type: 'SET_COUNT', count: 2 })
  assert.deepEqual(s.targets, [null, null])
})

// --- CLEAR ---------------------------------------------------------------------------------------

test('CLEAR : efface tout, y compris l\'arme', () => {
  const dirty = { weaponId: 'w1', targets: ['t1'], count: 2, bulletCount: 2, variantAB: 'B', isDualWield: true, aimTranches: 1, aimedLocation: 'leg' }
  assert.deepEqual(reduce(dirty, { type: 'CLEAR' }), INIT)
})

// --- dérivés -----------------------------------------------------------------------------------

test('effectiveAssaultCount : série multiple en CC seulement', () => {
  assert.equal(effectiveAssaultCount({ ...INIT, count: 3 }, 'CC'), 3)
  assert.equal(effectiveAssaultCount({ ...INIT, count: 3 }, 'RC'), 1)
  assert.equal(effectiveAssaultCount({ ...INIT, count: 3 }, 'RL'), 1)
})

test('assaultTargetsFilled / assaultTargetsComplete : comptent dans la série effective', () => {
  const s = { ...INIT, count: 3, targets: ['a', null, 'c'] }
  assert.equal(assaultTargetsFilled(s, 'CC'), 2)
  assert.equal(assaultTargetsComplete(s, 'CC'), false)
  // RC → 1 tir effectif, slot 0 rempli → complet
  assert.equal(assaultTargetsFilled(s, 'RC'), 1)
  assert.equal(assaultTargetsComplete(s, 'RC'), true)
})

test('assaultTargetsComplete : série pleine', () => {
  assert.equal(assaultTargetsComplete({ ...INIT, count: 2, targets: ['a', 'b'] }, 'CC'), true)
})
