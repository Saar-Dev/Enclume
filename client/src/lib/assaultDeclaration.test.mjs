import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ASSAULT_DECLARATION_INITIAL as INIT,
  assaultDeclarationReducer as reduce,
  effectiveAssaultCount,
  assaultTargetsFilled,
  assaultTargetsComplete,
  assaultIsAoeMode,
  assaultCheckInputs,
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

test('SET_SOLE_TARGET : impose exactement [tokenId] (clic direct)', () => {
  assert.deepEqual(
    reduce({ ...INIT, count: 3, targets: ['x', 'x', 'x'] }, { type: 'SET_SOLE_TARGET', tokenId: 'a' }).targets,
    ['a'],
  )
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

// --- SET_AOE_DIRECTION : zone d'effet, mutuellement exclusive avec targets (PLAN_AOE.md §8 étape 9) --

test('SET_AOE_DIRECTION : pose la direction et vide targets', () => {
  const s = reduce({ ...INIT, count: 3, targets: ['a', 'a', 'a'] }, { type: 'SET_AOE_DIRECTION', value: 45 })
  assert.equal(s.aoeDirection, 45)
  assert.deepEqual(s.targets, [])
})

test('SET_AOE_DIRECTION avec null : efface la direction sans toucher targets', () => {
  const s = reduce({ ...INIT, aoeDirection: 90, targets: [] }, { type: 'SET_AOE_DIRECTION', value: null })
  assert.equal(s.aoeDirection, null)
  assert.deepEqual(s.targets, [])
})

test('SET_TARGET efface une direction de zone en cours (exclusivité dans les deux sens)', () => {
  const s = reduce({ ...INIT, aoeDirection: 45 }, { type: 'SET_TARGET', index: 0, tokenId: 'a', seriesLength: 1 })
  assert.equal(s.aoeDirection, null)
  assert.deepEqual(s.targets, ['a'])
})

test('SET_SOLE_TARGET efface une direction de zone en cours', () => {
  const s = reduce({ ...INIT, aoeDirection: 45 }, { type: 'SET_SOLE_TARGET', tokenId: 'a' })
  assert.equal(s.aoeDirection, null)
  assert.deepEqual(s.targets, ['a'])
})

test('assaultIsAoeMode : reflète uniquement aoeDirection', () => {
  assert.equal(assaultIsAoeMode(INIT), false)
  assert.equal(assaultIsAoeMode({ ...INIT, aoeDirection: 0 }), true) // 0° est une direction valide, pas "absent"
  assert.equal(assaultIsAoeMode({ ...INIT, aoeDirection: null }), false)
})

test('assaultTargetsComplete : une direction de zone posée compte comme complet, sans cible', () => {
  assert.equal(assaultTargetsComplete({ ...INIT, aoeDirection: 45, targets: [] }, 'CC'), true)
})

test('SELECT_WEAPON et CLEAR remettent aoeDirection à null', () => {
  const dirty = { ...INIT, aoeDirection: 45 }
  assert.equal(reduce(dirty, { type: 'SELECT_WEAPON', weaponId: 'w2' }).aoeDirection, null)
  assert.equal(reduce(dirty, { type: 'CLEAR' }).aoeDirection, null)
})

// --- assaultCheckInputs (PLAN_RW_DECLARE_DERIVATION Étape B) --------------------------------------

const ctx = (over = {}) => ({
  started: true, hasWeapon: true, effectiveCount: 1, hasVariant: true,
  aimTranches: 0, aimReasons: [], ...over,
})

test('assaultCheckInputs : passe started/hasWeapon/hasVariant tels quels, aimActive dérivé', () => {
  const r = assaultCheckInputs(INIT, ctx({ started: false, hasWeapon: false, hasVariant: false, aimTranches: 2 }))
  assert.equal(r.started, false)
  assert.equal(r.hasWeapon, false)
  assert.equal(r.hasVariant, false)
  assert.equal(r.aimActive, true)
})

test('assaultCheckInputs : cible unique — compte les slots non nuls dans la série effective', () => {
  const state = { ...INIT, targets: ['e1', null, 'e3'] }
  assert.deepEqual(assaultCheckInputs(state, ctx({ effectiveCount: 3 })), {
    started: true, hasWeapon: true, targetsFilled: 2, targetsNeeded: 3,
    hasVariant: true, aimActive: false, aimReasons: [],
  })
})

test('assaultCheckInputs : effectiveCount tronque le décompte (cibles au-delà de la série ignorées)', () => {
  const state = { ...INIT, targets: ['e1', 'e2', 'e3'] }
  assert.equal(assaultCheckInputs(state, ctx({ effectiveCount: 2 })).targetsFilled, 2)
})

test('assaultCheckInputs : zone d\'effet — 1 attendue / 1 fournie, quel que soit targets', () => {
  const state = { ...INIT, aoeDirection: 42, targets: [] }
  const r = assaultCheckInputs(state, ctx({ effectiveCount: 3 }))
  assert.equal(r.targetsFilled, 1)
  assert.equal(r.targetsNeeded, 1)
})

test('assaultCheckInputs : zone d\'effet à 0° (falsy) reste une direction posée', () => {
  const r = assaultCheckInputs({ ...INIT, aoeDirection: 0 }, ctx())
  assert.equal(r.targetsNeeded, 1)
  assert.equal(r.targetsFilled, 1)
})

// Bug réel trouvé en session (Saar, 2026-09-04) : une arme de zone en mode de tir RC/RL
// (lance-flammes) ne pouvait jamais se déclarer — `hasVariant` restait `ctx.hasVariant` (donc
// `currentVariant != null`, faux tant qu'aucun volume RL n'est choisi) alors que le panneau AOE
// masque justement ce sélecteur. Le fusil à pompe (CC, variante toujours résolue par défaut) ne
// l'avait jamais révélé. `hasVariant`/`aimActive` doivent être neutralisés en zone d'effet, comme
// `targetsFilled`/`targetsNeeded` le sont déjà — même règle RAW que buildDeclarePayload.js
// (aucun mode de tir, aucun Tir visé sur une action de zone).
test('assaultCheckInputs : zone d\'effet — hasVariant forcé true même si ctx.hasVariant est false (lance-flammes RL sans volume choisi)', () => {
  const state = { ...INIT, aoeDirection: 42 }
  const r = assaultCheckInputs(state, ctx({ hasVariant: false }))
  assert.equal(r.hasVariant, true)
})

test('assaultCheckInputs : zone d\'effet — aimActive forcé false même si aimTranches > 0 (Tir visé configuré avant de passer en zone, jamais reset par SET_AOE_DIRECTION)', () => {
  const state = { ...INIT, aoeDirection: 42 }
  const r = assaultCheckInputs(state, ctx({ aimTranches: 3 }))
  assert.equal(r.aimActive, false)
})

test('assaultCheckInputs : hors zone d\'effet — hasVariant/aimActive suivent le contexte sans changement (non-régression fusil à pompe/Tir RL normal)', () => {
  assert.equal(assaultCheckInputs(INIT, ctx({ hasVariant: false })).hasVariant, false)
  assert.equal(assaultCheckInputs(INIT, ctx({ hasVariant: true })).hasVariant, true)
  assert.equal(assaultCheckInputs(INIT, ctx({ aimTranches: 2 })).aimActive, true)
  assert.equal(assaultCheckInputs(INIT, ctx({ aimTranches: 0 })).aimActive, false)
})

test('assaultCheckInputs : aimReasons absent → []', () => {
  assert.deepEqual(assaultCheckInputs(INIT, ctx({ aimReasons: undefined })).aimReasons, [])
})
