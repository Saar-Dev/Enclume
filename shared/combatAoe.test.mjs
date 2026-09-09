import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getAoeProfile, isAoeWeapon, getAoeMechanic, AOE_MECHANICS, isKnownAoeMechanic, weaponHasRangedAttackPath,
  GRENADE_DETONATION_MODES, GRENADE_DETONATION_DEFAULT, normalizeGrenadeDetonation,
} from './combatAoe.js'

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
  assert.equal(isKnownAoeMechanic('grenade_energy'), true)
  assert.equal(isKnownAoeMechanic('suppression'), false)
  assert.throws(() => AOE_MECHANICS.push('x'))
})

// normalizeGrenadeDetonation — mode de détonation d'une grenade (PLAN_GRENADES.md §3 pt 2 + §6 3f).
// Autorité unique de l'enum, lue client (toggle de déclaration) ET serveur (validation + dispatch).

test('GRENADE_DETONATION_MODES — les 3 modes RAW, défaut = minuterie, tableau gelé', () => {
  assert.deepEqual([...GRENADE_DETONATION_MODES], ['minuterie', 'percussion', 'drone'])
  assert.equal(GRENADE_DETONATION_DEFAULT, 'minuterie')
  assert.ok(GRENADE_DETONATION_MODES.includes(GRENADE_DETONATION_DEFAULT))
  assert.throws(() => GRENADE_DETONATION_MODES.push('x'))
})

test('normalizeGrenadeDetonation — chaque mode valide est renvoyé tel quel (drone inclus — le rejet est à la résolution, pas ici)', () => {
  assert.equal(normalizeGrenadeDetonation('minuterie'), 'minuterie')
  assert.equal(normalizeGrenadeDetonation('percussion'), 'percussion')
  assert.equal(normalizeGrenadeDetonation('drone'), 'drone')
})

test('normalizeGrenadeDetonation — absent / inconnu / mauvais type → défaut minuterie (fail-safe, jamais un throw)', () => {
  assert.equal(normalizeGrenadeDetonation(null), 'minuterie')
  assert.equal(normalizeGrenadeDetonation(undefined), 'minuterie')
  assert.equal(normalizeGrenadeDetonation(''), 'minuterie')
  assert.equal(normalizeGrenadeDetonation('MINUTERIE'), 'minuterie') // exact match seulement, pas de normalisation de casse
  assert.equal(normalizeGrenadeDetonation('timer'), 'minuterie')
  assert.equal(normalizeGrenadeDetonation(42), 'minuterie')
  assert.equal(normalizeGrenadeDetonation({ mode: 'percussion' }), 'minuterie')
  assert.equal(normalizeGrenadeDetonation(['percussion']), 'minuterie')
})
