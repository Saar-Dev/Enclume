import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveDualWieldFire } from './dualWieldRules.js'

test('COM29 - pas de dual-wield : tir simple normal si munitions ok', () => {
  const r = resolveDualWieldFire({ primaryAmmoOk: true, isDualWield: false })
  assert.deepEqual(r, { fires: 'primary', dualWieldApplied: false, degraded: null })
})

test('COM29 - pas de dual-wield : bloque si la seule arme est a sec', () => {
  const r = resolveDualWieldFire({ primaryAmmoOk: false, isDualWield: false })
  assert.deepEqual(r, { fires: null, dualWieldApplied: false, degraded: null })
})

test('COM29 - dual-wield, les deux armes chargees : tir a deux armes complet', () => {
  const r = resolveDualWieldFire({ primaryAmmoOk: true, offhandAmmoOk: true, isDualWield: true })
  assert.deepEqual(r, { fires: 'both', dualWieldApplied: true, degraded: null })
})

test('COM29 - dual-wield, main non directrice a sec : tir simple main directrice', () => {
  const r = resolveDualWieldFire({ primaryAmmoOk: true, offhandAmmoOk: false, isDualWield: true })
  assert.deepEqual(r, { fires: 'primary', dualWieldApplied: false, degraded: 'offhand' })
})

test('COM29 - dual-wield, main directrice a sec : tir simple main non directrice', () => {
  const r = resolveDualWieldFire({ primaryAmmoOk: false, offhandAmmoOk: true, isDualWield: true })
  assert.deepEqual(r, { fires: 'offhand', dualWieldApplied: false, degraded: 'primary' })
})

test('COM29 - dual-wield, les deux armes a sec : bloque (aucune main ne peut tirer)', () => {
  const r = resolveDualWieldFire({ primaryAmmoOk: false, offhandAmmoOk: false, isDualWield: true })
  assert.deepEqual(r, { fires: null, dualWieldApplied: false, degraded: null })
})

test('COM29 - dual-wield sans offhandAmmoOk fourni (pas d\'arme en main non directrice) : degrade par defaut', () => {
  const r = resolveDualWieldFire({ primaryAmmoOk: true, isDualWield: true })
  assert.deepEqual(r, { fires: 'primary', dualWieldApplied: false, degraded: 'offhand' })
})
