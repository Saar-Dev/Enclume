import test from 'node:test'
import assert from 'node:assert/strict'

import { getAoeProfile, isAoeWeapon, getAoeMechanic, AOE_MECHANICS, isKnownAoeMechanic, weaponHasRangedAttackPath } from './combatAoe.js'

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
  const p = { shape: 'circle', mechanic: 'suppression' }
  assert.deepEqual(getAoeProfile(p), p)
  assert.equal(isKnownAoeMechanic('suppression'), false)
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

// weaponHasRangedAttackPath — gate de la liste « Tir » humanoïde (PLAN_GRENADES.md §10.1).
// ADMET une candidate ; ne CLASSE PAS Tir/CaC (ça = category === 'Arme de contact').

test('weaponHasRangedAttackPath — arme à feu (fire_mode) → true', () => {
  assert.equal(weaponHasRangedAttackPath({ ref_fire_mode: 'CC/RC' }), true)
  assert.equal(weaponHasRangedAttackPath({ fire_mode: 'rl' }), true)
})

test('weaponHasRangedAttackPath — mécanisme de zone câblé (aoe_profile valide) → true', () => {
  assert.equal(weaponHasRangedAttackPath({ ref_aoe_profile: { shape: 'circle', mechanic: 'grenade_frag', radiusM: 15 } }), true)
  assert.equal(weaponHasRangedAttackPath({ aoe_profile: '{"shape":"cone","mechanic":"flamethrower"}' }), true)
})

test('weaponHasRangedAttackPath — arme sans fire_mode ni aoe_profile → false (pas de chemin)', () => {
  // Arme de jet (moteur jamais câblé), grenade non encore migrée
  assert.equal(weaponHasRangedAttackPath({ ref_category: 'Armes de jet', ref_damage_h: '2D10+5' }), false)
  assert.equal(weaponHasRangedAttackPath({ ref_category: 'Grenade', ref_damage_h: '5D10', ref_aoe_profile: null }), false)
})

test('weaponHasRangedAttackPath — arme de contact (aucun fire_mode) → false', () => {
  assert.equal(weaponHasRangedAttackPath({ ref_category: 'Arme de contact', ref_damage_h: '1D10', ref_shock: '2D10' }), false)
})

test('weaponHasRangedAttackPath — aoe_profile structurellement invalide → false', () => {
  assert.equal(weaponHasRangedAttackPath({ ref_aoe_profile: { shape: 'banana' } }), false)
  assert.equal(weaponHasRangedAttackPath({ ref_aoe_profile: 'pas du json' }), false)
})

test('weaponHasRangedAttackPath — null/undefined → false (jamais un throw)', () => {
  assert.equal(weaponHasRangedAttackPath(null), false)
  assert.equal(weaponHasRangedAttackPath(undefined), false)
  assert.equal(weaponHasRangedAttackPath({}), false)
})

test('AOE_MECHANICS / isKnownAoeMechanic — les mécanismes câblés à ce jour, tableau gelé', () => {
  assert.equal(isKnownAoeMechanic('shotgun_spread'), true)
  assert.equal(isKnownAoeMechanic('flamethrower'), true)
  assert.equal(isKnownAoeMechanic('grenade_frag'), true)
  assert.equal(isKnownAoeMechanic('suppression'), false)
  assert.throws(() => AOE_MECHANICS.push('x'))
})
