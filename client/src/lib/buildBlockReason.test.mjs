import test from 'node:test'
import assert from 'node:assert/strict'

import { buildBlockReason } from './buildBlockReason.js'

test('bag vide / rien de commencé → null', () => {
  assert.equal(buildBlockReason(), null)
  assert.equal(buildBlockReason({}), null)
  assert.equal(buildBlockReason({ attackSelected: false, meleeSelected: false, reloadSelected: false }), null)
})

// --- Tir ---
test('tir : arme non choisie', () => {
  assert.equal(
    buildBlockReason({ attackSelected: true, attackHasWeapon: false }),
    'Sélectionner une arme de tir',
  )
})

test('tir : cible manquante (simple / multi)', () => {
  assert.equal(
    buildBlockReason({ attackSelected: true, attackHasWeapon: true, attackTargetsFilled: 0, attackTargetsNeeded: 1 }),
    'Choisir une cible',
  )
  assert.equal(
    buildBlockReason({ attackSelected: true, attackHasWeapon: true, attackTargetsFilled: 1, attackTargetsNeeded: 3 }),
    'Choisir 3 cibles',
  )
})

test('tir : mode de tir non configuré', () => {
  assert.equal(
    buildBlockReason({ attackSelected: true, attackHasWeapon: true, attackTargetsFilled: 1, attackTargetsNeeded: 1, attackHasVariant: false }),
    'Configurer le mode de tir',
  )
})

test('tir visé inéligible → message avec les raisons jointes', () => {
  assert.equal(
    buildBlockReason({
      attackSelected: true, attackHasWeapon: true, attackTargetsFilled: 1, attackTargetsNeeded: 1,
      attackHasVariant: true, aimActive: true, aimReasons: ['changement de posture', 'déplacement'],
    }),
    'Tir visé impossible : changement de posture, déplacement',
  )
})

test('tir complet (Tir visé éligible) → null', () => {
  assert.equal(
    buildBlockReason({
      attackSelected: true, attackHasWeapon: true, attackTargetsFilled: 1, attackTargetsNeeded: 1,
      attackHasVariant: true, aimActive: true, aimReasons: [],
    }),
    null,
  )
})

// --- Corps à corps ---
test('CaC : Charge sans déplacement', () => {
  assert.equal(
    buildBlockReason({ meleeSelected: true, isCharge: true, chargeHasMove: false }),
    'Définir le déplacement de la Charge',
  )
})

test('CaC : cible manquante', () => {
  assert.equal(
    buildBlockReason({ meleeSelected: true, meleeTargetsFilled: 0, meleeTargetsNeeded: 1 }),
    'Choisir une cible',
  )
})

test('CaC défensif / retraite : aucune cible requise → null', () => {
  assert.equal(
    buildBlockReason({ meleeSelected: true, meleeDefensif: true, meleeTargetsFilled: 0, meleeTargetsNeeded: 1 }),
    null,
  )
})

// --- Rechargement ---
test('rechargement : arme non sélectionnée', () => {
  assert.equal(
    buildBlockReason({ reloadSelected: true, reloadHasWeapon: false }),
    "Sélectionner l'arme à recharger",
  )
})

test('rechargement : munitions non choisies', () => {
  assert.equal(
    buildBlockReason({ reloadSelected: true, reloadHasWeapon: true, reloadHasAmmo: false }),
    'Choisir des munitions',
  )
})

test('rechargement OK si une attaque est aussi déclarée (elle porte l\'arme) → pas de raison reload', () => {
  assert.equal(
    buildBlockReason({
      reloadSelected: true, reloadHasWeapon: false, reloadHasAmmo: false,
      attackSelected: true, attackHasWeapon: true, attackTargetsFilled: 1, attackTargetsNeeded: 1, attackHasVariant: true,
    }),
    null,
  )
})

// --- Précédence ---
test('précédence : le Tir passe avant le CaC', () => {
  assert.equal(
    buildBlockReason({
      attackSelected: true, attackHasWeapon: false,
      meleeSelected: true, meleeTargetsFilled: 0, meleeTargetsNeeded: 1,
    }),
    'Sélectionner une arme de tir',
  )
})
