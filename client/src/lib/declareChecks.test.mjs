import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assaultCheck, meleeCheck, reloadCheck, buildBlockReason, hasSomethingToDeclare,
} from './declareChecks.js'

// --- assaultCheck ---------------------------------------------------------------------------------

test('assaultCheck — non commencé → valide, sans raison', () => {
  assert.deepEqual(assaultCheck({ started: false }), { valid: true, reason: null })
  assert.deepEqual(assaultCheck(), { valid: true, reason: null })
})

test('assaultCheck — arme manquante', () => {
  assert.deepEqual(assaultCheck({ started: true, hasWeapon: false }),
    { valid: false, reason: 'Sélectionner une arme de tir' })
})

test('assaultCheck — cibles manquantes : libellé sur le NOMBRE RESTANT', () => {
  assert.equal(assaultCheck({ started: true, hasWeapon: true, targetsFilled: 0, targetsNeeded: 1 }).reason,
    'Choisir une cible')
  assert.equal(assaultCheck({ started: true, hasWeapon: true, targetsFilled: 0, targetsNeeded: 3 }).reason,
    'Choisir 3 cibles')
  assert.equal(assaultCheck({ started: true, hasWeapon: true, targetsFilled: 2, targetsNeeded: 3 }).reason,
    'Choisir une cible')  // 1 restante
})

test('assaultCheck — mode de tir non configuré', () => {
  assert.equal(assaultCheck({
    started: true, hasWeapon: true, targetsFilled: 1, targetsNeeded: 1, hasVariant: false,
  }).reason, 'Configurer le mode de tir')
})

test('assaultCheck — Tir visé inéligible → raisons jointes', () => {
  assert.equal(assaultCheck({
    started: true, hasWeapon: true, targetsFilled: 1, targetsNeeded: 1, hasVariant: true,
    aimActive: true, aimReasons: ['changement de posture', 'déplacement'],
  }).reason, 'Tir visé impossible : changement de posture, déplacement')
})

test('assaultCheck — tir complet (Tir visé éligible) → valide', () => {
  assert.deepEqual(assaultCheck({
    started: true, hasWeapon: true, targetsFilled: 1, targetsNeeded: 1, hasVariant: true,
    aimActive: true, aimReasons: [],
  }), { valid: true, reason: null })
})

// --- meleeCheck ----------------------------------------------------------------------------------

test('meleeCheck — non commencé / mode passif → valide', () => {
  assert.deepEqual(meleeCheck({ started: false }), { valid: true, reason: null })
  assert.deepEqual(meleeCheck({ started: true, defensif: true, targetsFilled: 0, targetsNeeded: 2 }),
    { valid: true, reason: null })
})

test('meleeCheck — cible manquante (hors Charge)', () => {
  assert.equal(meleeCheck({ started: true, targetsFilled: 0, targetsNeeded: 1 }).reason, 'Choisir une cible')
  assert.equal(meleeCheck({ started: true, targetsFilled: 0, targetsNeeded: 2 }).reason, 'Choisir 2 cibles')
  assert.equal(meleeCheck({ started: true, targetsFilled: 1, targetsNeeded: 2 }).reason, 'Choisir une cible')
})

test('meleeCheck — Charge : déplacement d\'abord, puis cible', () => {
  assert.equal(meleeCheck({ started: true, isCharge: true, chargeHasMove: false, chargeHasTarget: false }).reason,
    'Définir le déplacement de la Charge')
  assert.equal(meleeCheck({ started: true, isCharge: true, chargeHasMove: true, chargeHasTarget: false }).reason,
    'Choisir une cible')
  assert.deepEqual(meleeCheck({ started: true, isCharge: true, chargeHasMove: true, chargeHasTarget: true }),
    { valid: true, reason: null })
})

// --- reloadCheck ---------------------------------------------------------------------------------

test('reloadCheck — non commencé / couvert par une attaque → valide', () => {
  assert.deepEqual(reloadCheck({ started: false }), { valid: true, reason: null })
  assert.deepEqual(reloadCheck({ started: true, coveredByAttack: true, hasWeapon: false, hasAmmo: false }),
    { valid: true, reason: null })
})

test('reloadCheck — arme / munitions manquantes', () => {
  assert.equal(reloadCheck({ started: true, hasWeapon: false }).reason, "Sélectionner l'arme à recharger")
  assert.equal(reloadCheck({ started: true, hasWeapon: true, hasAmmo: false }).reason, 'Choisir des munitions')
})

// --- buildBlockReason (précédence) --------------------------------------------------------------

test('buildBlockReason — premier .reason non nul, précédence Tir → CaC → Rechargement', () => {
  assert.equal(buildBlockReason(), null)
  assert.equal(buildBlockReason({ assault: { reason: null }, melee: { reason: null }, reload: { reason: null } }), null)
  assert.equal(buildBlockReason({
    assault: { reason: 'A' }, melee: { reason: 'B' }, reload: { reason: 'C' },
  }), 'A')
  assert.equal(buildBlockReason({
    assault: { reason: null }, melee: { reason: 'B' }, reload: { reason: 'C' },
  }), 'B')
  assert.equal(buildBlockReason({ reload: { reason: 'C' } }), 'C')
})

// --- hasSomethingToDeclare --------------------------------------------------------------------------

test('hasSomethingToDeclare — chaque source seule → true, aucune → false', () => {
  assert.equal(hasSomethingToDeclare(), false)
  assert.equal(hasSomethingToDeclare({}), false)
  for (const flag of ['attackStarted', 'meleeStarted', 'reloadStarted', 'hasMove', 'hasStateChange', 'hasQuick']) {
    assert.equal(hasSomethingToDeclare({ [flag]: true }), true, flag)
  }
})
