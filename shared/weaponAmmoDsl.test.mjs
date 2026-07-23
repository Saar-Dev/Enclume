import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseAmmoEffects, resolveDmgEffect, resolveChocFormula,
  reduceDiceCount, resolveAmmoMechanic, resolveMechanicDamageFormula,
} from './weaponAmmoDsl.js'

// ─── Lot A — parseAmmoEffects / resolveDmgEffect ───────────────────────────────────────────────────

test('parseAmmoEffects - BASE, SET, ADD, MUL reconnus', () => {
  assert.deepEqual(parseAmmoEffects('DMG=BASE'), { dmg: { action: 'BASE', value: null }, choc: null, tags: {}, unknown: [] })
  assert.deepEqual(parseAmmoEffects('DMG=SET(3D10+4)').dmg, { action: 'SET', value: '3D10+4' })
  assert.deepEqual(parseAmmoEffects('DMG=ADD(1D10)').dmg, { action: 'ADD', value: '1D10' })
  assert.deepEqual(parseAmmoEffects('DMG=MUL(0.5)').dmg, { action: 'MUL', value: '0.5' })
})

test('parseAmmoEffects - TXT regroupe des sous-tags, dont FX', () => {
  const parsed = parseAmmoEffects('DMG=SET(3D10+4);TXT=PEN=SET(15)|FX=APHC')
  assert.deepEqual(parsed.tags, { PEN: 'SET(15)', FX: 'APHC' })
})

test('parseAmmoEffects - null/vide/action ou cle inconnue -> unknown, jamais un throw', () => {
  assert.deepEqual(parseAmmoEffects(null), { dmg: null, choc: null, tags: {}, unknown: [] })
  const parsed = parseAmmoEffects('WTF=1;DMG=NOPE(1)')
  assert.equal(parsed.dmg, null)
  assert.ok(parsed.unknown.length >= 1)
})

test('resolveDmgEffect - ADD avec scaling (virgule) hors scope Lot A, repli sur formule de base', () => {
  const resolved = resolveDmgEffect('4D10', { action: 'ADD', value: '1D10,+1/5D10_ARME' })
  assert.deepEqual(resolved, { baseFormula: '4D10', extraFormula: null, mulFactor: 1 })
})

// ─── Lot B — resolveChocFormula ────────────────────────────────────────────────────────────────────

test('resolveChocFormula - SET fixe reconnu, ADD (scaling) hors scope -> null', () => {
  assert.equal(resolveChocFormula({ action: 'SET', value: '1D10+2' }), '1D10+2')
  assert.equal(resolveChocFormula({ action: 'ADD', value: '1D10,+1/5D10_ARME' }), null)
  assert.equal(resolveChocFormula(null), null)
})

// ─── Lot C1 — reduceDiceCount ──────────────────────────────────────────────────────────────────────

test('reduceDiceCount - decremente uniquement le nombre de des, garde faces/modificateur', () => {
  assert.equal(reduceDiceCount('4D10', 1), '3D10')
  assert.equal(reduceDiceCount('4D10+1', 1), '3D10+1')
  assert.equal(reduceDiceCount('2D10+3', 1), '1D10+3')
})

test('reduceDiceCount - jamais sous 1 de', () => {
  assert.equal(reduceDiceCount('1D10', 1), '1D10')
  assert.equal(reduceDiceCount('D10', 1), '1D10')
})

test('reduceDiceCount - formule non reconnue -> inchangee, jamais un throw', () => {
  assert.equal(reduceDiceCount('3D10+1D6', 1), '3D10+1D6')
  assert.equal(reduceDiceCount(null, 1), null)
})

// ─── Lot C1 — resolveAmmoMechanic / resolveMechanicDamageFormula ───────────────────────────────────

test('resolveAmmoMechanic - FX inconnu ou absent -> null (Assommante/IEM/aucune mecanique C1)', () => {
  assert.equal(resolveAmmoMechanic('ASSOMMANTE'), null)
  assert.equal(resolveAmmoMechanic('IEM'), null)
  assert.equal(resolveAmmoMechanic(undefined), null)
})

test('resolveMechanicDamageFormula - APHC : degats inchanges, armure 2/3 floor', () => {
  const mechanic = resolveAmmoMechanic('APHC')
  assert.equal(mechanic.armorMulFactor, 2 / 3)
  assert.equal(mechanic.armorRound, 'floor')
  const resolved = resolveMechanicDamageFormula('4D10', mechanic, null)
  assert.deepEqual(resolved, { baseFormula: '4D10', bonusFormula: null, flatBonus: 0, dropoffFormula: null })
})

test('resolveMechanicDamageFormula - SAP/SLAP : -1 de calcule depuis la formule arme, armure x0.5', () => {
  const sap = resolveAmmoMechanic('SAP')
  assert.equal(sap.armorMulFactor, 0.5)
  assert.deepEqual(resolveMechanicDamageFormula('4D10', sap, null).baseFormula, '3D10')
  const slap = resolveAmmoMechanic('SLAP')
  assert.deepEqual(resolveMechanicDamageFormula('2D10+3', slap, null).baseFormula, '1D10+3')
})

test('resolveMechanicDamageFormula - HP : bonus fixe +5 jamais lance, armure x1.5', () => {
  const hp = resolveAmmoMechanic('HP')
  assert.equal(hp.armorMulFactor, 1.5)
  const resolved = resolveMechanicDamageFormula('4D10', hp, null)
  assert.deepEqual(resolved, { baseFormula: '4D10', bonusFormula: null, flatBonus: 5, dropoffFormula: null })
})

test('resolveMechanicDamageFormula - EXPLOSIVE : +1D10 lance separement, choc fixe 1D10, armure x2', () => {
  const explosive = resolveAmmoMechanic('EXPLOSIVE')
  assert.equal(explosive.armorMulFactor, 2)
  assert.equal(explosive.chocFixed, '1D10')
  const resolved = resolveMechanicDamageFormula('4D10', explosive, null)
  assert.deepEqual(resolved, { baseFormula: '4D10', bonusFormula: '1D10', flatBonus: 0, dropoffFormula: null })
})

test('resolveMechanicDamageFormula - SHRAPNEL : degression par bande de portee, armure x1.5 polaris', () => {
  const shrapnel = resolveAmmoMechanic('SHRAPNEL')
  assert.equal(shrapnel.armorMulFactor, 1.5)
  assert.equal(shrapnel.armorRound, 'polaris')
  assert.equal(resolveMechanicDamageFormula('4D10', shrapnel, 'bout_portant').dropoffFormula, null)
  assert.equal(resolveMechanicDamageFormula('4D10', shrapnel, 'courte').dropoffFormula, '1D10')
  assert.equal(resolveMechanicDamageFormula('4D10', shrapnel, 'moyenne').dropoffFormula, '1D10')
  assert.equal(resolveMechanicDamageFormula('4D10', shrapnel, 'longue').dropoffFormula, '2D10')
  assert.equal(resolveMechanicDamageFormula('4D10', shrapnel, 'extreme').dropoffFormula, '3D10')
})

test('resolveMechanicDamageFormula - SHRAPNEL sans rangeBand connu -> pas de degression (fail-safe)', () => {
  const shrapnel = resolveAmmoMechanic('SHRAPNEL')
  assert.equal(resolveMechanicDamageFormula('4D10', shrapnel, null).dropoffFormula, null)
  assert.equal(resolveMechanicDamageFormula('4D10', shrapnel, 'inconnue').dropoffFormula, null)
})

test('resolveMechanicDamageFormula - mechanic null -> null (pas de mecanique C1 applicable)', () => {
  assert.equal(resolveMechanicDamageFormula('4D10', null, 'courte'), null)
})
