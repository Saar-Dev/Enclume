import test from 'node:test'
import assert from 'node:assert/strict'

import { getAoeProfile, isAoeWeapon, getAoeMechanic, AOE_MECHANICS, isKnownAoeMechanic } from './combatAoe.js'

// getAoeProfile — cadre PLAN_ARMES_SPECIALES.md §1.6, segment 0b. L'AOE-ness est une donnée
// (ref_equipment.aoe_profile), plus un nom d'arme en dur.

test('getAoeProfile — valeur absente (null/undefined) → null', () => {
  assert.equal(getAoeProfile(null), null)
  assert.equal(getAoeProfile(undefined), null)
})

test('getAoeProfile — objet valide (JSONB déjà parsé) → renvoyé tel quel', () => {
  const p = { shape: 'ray', mechanic: 'shotgun_spread' }
  assert.deepEqual(getAoeProfile(p), p)
  const c = { shape: 'cone', mechanic: 'flamethrower', angleDeg: 30 }
  assert.deepEqual(getAoeProfile(c), c)
})

test('getAoeProfile — chaîne JSON (certains chemins pg) → parsée', () => {
  assert.deepEqual(
    getAoeProfile('{"shape":"cone","mechanic":"flamethrower","angleDeg":30}'),
    { shape: 'cone', mechanic: 'flamethrower', angleDeg: 30 },
  )
})

test('getAoeProfile — chaîne non-JSON → null (jamais un throw)', () => {
  assert.equal(getAoeProfile('pas du json'), null)
  assert.equal(getAoeProfile('{bancal'), null)
})

test('getAoeProfile — shape inconnue → null', () => {
  assert.equal(getAoeProfile({ shape: 'banana', mechanic: 'x' }), null)
  assert.equal(getAoeProfile({ shape: 'rectangle', mechanic: 'x' }), null)
})

test('getAoeProfile — mechanic absent / vide / non-chaîne → null', () => {
  assert.equal(getAoeProfile({ shape: 'ray' }), null)
  assert.equal(getAoeProfile({ shape: 'ray', mechanic: '' }), null)
  assert.equal(getAoeProfile({ shape: 'ray', mechanic: 42 }), null)
})

test('getAoeProfile — tableau ou primitive → null', () => {
  assert.equal(getAoeProfile([1, 2]), null)
  assert.equal(getAoeProfile(7), null)
  assert.equal(getAoeProfile(true), null)
})

test('getAoeProfile — structure valide mais mechanic non câblé → RENVOYÉ (garde AOE_MECHANICS = dispatch serveur, pas ici)', () => {
  const p = { shape: 'circle', mechanic: 'grenade_fragmentation' }
  assert.deepEqual(getAoeProfile(p), p)
  assert.equal(isKnownAoeMechanic('grenade_fragmentation'), false)
})

test('isAoeWeapon — miroir de getAoeProfile != null', () => {
  assert.equal(isAoeWeapon({ shape: 'ray', mechanic: 'shotgun_spread' }), true)
  assert.equal(isAoeWeapon(null), false)
  assert.equal(isAoeWeapon({ shape: 'ray' }), false)
})

test('getAoeMechanic — identifiant ou null', () => {
  assert.equal(getAoeMechanic({ shape: 'cone', mechanic: 'flamethrower' }), 'flamethrower')
  assert.equal(getAoeMechanic('{"shape":"ray","mechanic":"shotgun_spread"}'), 'shotgun_spread')
  assert.equal(getAoeMechanic(null), null)
  assert.equal(getAoeMechanic({ shape: 'ray' }), null)
})

test('AOE_MECHANICS / isKnownAoeMechanic — les 2 mécanismes câblés à ce jour, tableau gelé', () => {
  assert.equal(isKnownAoeMechanic('shotgun_spread'), true)
  assert.equal(isKnownAoeMechanic('flamethrower'), true)
  assert.equal(isKnownAoeMechanic('suppression'), false)
  assert.throws(() => AOE_MECHANICS.push('x'))
})
