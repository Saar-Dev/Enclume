import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STATE_TRANSITION_COST,
  stateTransitionCost,
  iniDeltaBreakdown,
  computeIniDelta,
  projectedInitiative,
} from './combatIniCost.js'

test('stateTransitionCost — transitions d\'arme (LdB, dégainer/rengainer)', () => {
  assert.equal(stateTransitionCost('weapon', 'holstered', 'drawn'), -5)
  assert.equal(stateTransitionCost('weapon', 'drawn', 'holstered'), -10)
  assert.equal(stateTransitionCost('weapon', 'ready', 'drawn'), -3)
})

test('stateTransitionCost — mode de tir : tout changement -3', () => {
  assert.equal(stateTransitionCost('fire_mode', 'cc', 'rl'), -3)
  assert.equal(stateTransitionCost('fire_mode', 'rl', 'rc'), -3)
})

test('stateTransitionCost — vitesse : Précipiter +3, ralentir gratuit', () => {
  assert.equal(stateTransitionCost('vitesse', 'normal', 'rushed'), 3)
  assert.equal(stateTransitionCost('vitesse', 'rushed', 'normal'), 0)
  assert.equal(stateTransitionCost('vitesse', 'normal', 'delayed'), 0)
})

test('stateTransitionCost — couverture : aucun coût d\'Initiative (flag défensif pur)', () => {
  assert.deepEqual(STATE_TRANSITION_COST.cover, {})
  assert.equal(stateTransitionCost('cover', 'exposed', 'important'), 0)
})

test('stateTransitionCost — champ absent / identique = 0, jamais de transition fantôme', () => {
  assert.equal(stateTransitionCost('position', undefined, 'standing'), 0)
  assert.equal(stateTransitionCost('position', 'standing', undefined), 0)
  assert.equal(stateTransitionCost('weapon', 'drawn', 'drawn'), 0)
  assert.equal(stateTransitionCost('vitesse', 'normal', 'inconnu'), 0)
})

test('computeIniDelta — déclaration vide = 0', () => {
  assert.equal(computeIniDelta(), 0)
  assert.equal(computeIniDelta({ prevStates: { position: 'standing' }, nextStates: {} }), 0)
})

test('computeIniDelta — entrées null explicites (payload forgé) ne lèvent jamais', () => {
  assert.equal(computeIniDelta({ prevStates: null, nextStates: null, move: null, quick: null, aim: null }), 0)
})

test('computeIniDelta — nextStates : champ absent = inchangé', () => {
  const prevStates = { position: 'standing', weapon: 'drawn', fire_mode: 'cc', cover: 'exposed', vitesse: 'normal' }
  // seul le mode de tir change
  assert.equal(computeIniDelta({ prevStates, nextStates: { fire_mode: 'rl' } }), -3)
})

test('computeIniDelta — cumul transitions + déplacement + actions rapides', () => {
  const prevStates = { position: 'standing', weapon: 'holstered', fire_mode: 'cc', cover: 'exposed', vitesse: 'normal' }
  const nextStates = { position: 'crouching', weapon: 'drawn' }
  // crouching (-3) + dégainer (-5) + déplacement (-5) + observer x1 (-5) + phrase (-3) = -21
  assert.equal(computeIniDelta({
    prevStates, nextStates,
    move: { ini_mod: -5 },
    quick: { observer: 1, phrase: true },
  }), -21)
})

test('computeIniDelta — Charge / Retraite : déplacement gratuit', () => {
  const prevStates = { position: 'standing' }
  assert.equal(computeIniDelta({ prevStates, nextStates: {}, move: { ini_mod: -7 }, combatMode: 'charge' }), 0)
  assert.equal(computeIniDelta({ prevStates, nextStates: {}, move: { ini_mod: -7 }, combatMode: 'retraite' }), 0)
  // mode normal : le déplacement coûte
  assert.equal(computeIniDelta({ prevStates, nextStates: {}, move: { ini_mod: -7 }, combatMode: 'normal' }), -7)
})

test('computeIniDelta — Tir visé délègue à getAimIniCost (autorité partagée)', () => {
  // 2 tranches classiques = -4 (AIM_INI_PER_TRANCHE = -2)
  assert.equal(computeIniDelta({ aim: { aimTranches: 2 } }), -4)
  // 0 tranche = pas de coût
  assert.equal(computeIniDelta({ aim: { aimTranches: 0 } }), 0)
})

test('iniDeltaBreakdown — un poste par contribution non nulle, structuré pour l\'i18n client', () => {
  const prevStates = { position: 'standing', weapon: 'holstered', fire_mode: 'cc', cover: 'exposed', vitesse: 'normal' }
  const nextStates = { position: 'crouching', weapon: 'drawn' }
  const lines = iniDeltaBreakdown({
    prevStates, nextStates,
    move: { ini_mod: -5 },
    aim: { aimTranches: 2 },
    quick: { observer: 1, reperer: 0, phrase: true },
  })
  assert.deepEqual(lines, [
    { kind: 'state', key: 'position', from: 'standing', to: 'crouching', value: -3 },
    { kind: 'state', key: 'weapon', from: 'holstered', to: 'drawn', value: -5 },
    { kind: 'move', value: -5 },
    { kind: 'aim', count: 2, value: -4 },
    { kind: 'observer', count: 1, value: -5 },
    { kind: 'phrase', value: -3 },
  ])
})

test('iniDeltaBreakdown — postes à coût nul omis (move_max, couverture, vitesse ralentie)', () => {
  const lines = iniDeltaBreakdown({
    prevStates: { cover: 'exposed', vitesse: 'rushed' },
    nextStates: { cover: 'important', vitesse: 'normal' },
    move: { ini_mod: 0 },
  })
  assert.deepEqual(lines, [])
})

test('computeIniDelta === somme de iniDeltaBreakdown (invariant widget/popover)', () => {
  const cases = [
    {},
    { prevStates: { position: 'prone' }, nextStates: { position: 'standing' } },
    { prevStates: { weapon: 'holstered' }, nextStates: { weapon: 'drawn' }, move: { ini_mod: -7 }, combatMode: 'charge' },
    { move: { ini_mod: -5 }, aim: { aimTranches: 3, lunetteNiveau: 2 }, quick: { observer: 2, reperer: 1, phrase: true } },
  ]
  for (const c of cases) {
    assert.equal(computeIniDelta(c), iniDeltaBreakdown(c).reduce((s, l) => s + l.value, 0))
  }
})

test('projectedInitiative — projeté = courant + delta', () => {
  assert.deepEqual(projectedInitiative(12, -5), { projected: 7, willBeLost: false })
  assert.deepEqual(projectedInitiative(4, -4), { projected: 0, willBeLost: true })
  assert.deepEqual(projectedInitiative(3, -8), { projected: -5, willBeLost: true })
})
