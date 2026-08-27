import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseWeaponRangeBands, resolveWeaponRangeBand, resolveMeleeReachM,
  resolveShotgunSpread, SHOTGUN_SPREAD_BY_BAND,
} from './combatRange.js'

// ref_range réel du Klauss (seul fusil à pompe du catalogue, migrations/303_ref_equipment_seed.js,
// confirmé Saar 2026-08-26/27) — pas une valeur inventée.
const KLAUSS_REF_RANGE = '2/7/14/28 (35)'

test('parse les cinq bandes Polaris exprimees en metres', () => {
  assert.deepEqual(parseWeaponRangeBands('40/150/300/600 (1 000)'), [40, 150, 300, 600, 1000])
  assert.equal(resolveWeaponRangeBand(40, '40/150/300/600 (1 000)').band, 'bout_portant')
  assert.equal(resolveWeaponRangeBand(151, '40/150/300/600 (1 000)').band, 'moyenne')
  assert.equal(resolveWeaponRangeBand(900, '40/150/300/600 (1 000)').band, 'extreme')
  assert.equal(resolveWeaponRangeBand(1001, '40/150/300/600 (1 000)').status, 'out-of-range')
})

test('une portee unique choisit volontairement la bande la moins favorable', () => {
  assert.equal(resolveWeaponRangeBand(50, '100').band, 'extreme')
})

test('resolveMeleeReachM : 3m de base + allonge parsee, mains nues = 0', () => {
  assert.equal(resolveMeleeReachM(null), 3)
  assert.equal(resolveMeleeReachM(undefined), 3)
  assert.equal(resolveMeleeReachM('1'), 4)
  assert.equal(resolveMeleeReachM('abc'), 3)
})

// ─── resolveShotgunSpread — PLAN_AOE.md §4/§6.2bis, table RAW fusil à pompe ──────────────────────

test('resolveShotgunSpread — Klauss à bout portant : cible unique, pas de zone géométrique', () => {
  const result = resolveShotgunSpread(1, KLAUSS_REF_RANGE)
  assert.equal(result.band, 'bout_portant')
  assert.equal(result.spread.widthM, null)
  assert.equal(result.spread.damageDice, '+1D10')
})

test('resolveShotgunSpread — Klauss à portée moyenne : zone 2m, -1D10, jamais de Test de Chance', () => {
  const result = resolveShotgunSpread(10, KLAUSS_REF_RANGE)
  assert.equal(result.band, 'moyenne')
  assert.deepEqual(result.spread, { widthM: 2, damageDice: '-1D10', savePossible: false })
})

test('resolveShotgunSpread — Klauss à portée longue/extrême : Test de Chance apparaît, bonus +5 seulement à l’extrême', () => {
  const longue = resolveShotgunSpread(20, KLAUSS_REF_RANGE)
  assert.equal(longue.band, 'longue')
  assert.equal(longue.spread.savePossible, true)
  assert.equal(longue.spread.saveBonus, 0)

  const extreme = resolveShotgunSpread(30, KLAUSS_REF_RANGE)
  assert.equal(extreme.band, 'extreme')
  assert.equal(extreme.spread.saveBonus, 5)
})

test('resolveShotgunSpread — hors de portée : statut propagé, jamais de spread renvoyé', () => {
  const result = resolveShotgunSpread(100, KLAUSS_REF_RANGE)
  assert.equal(result.status, 'out-of-range')
  assert.equal(result.spread, undefined)
})

test('SHOTGUN_SPREAD_BY_BAND — une entrée par palier RAW, aucun trou', () => {
  for (const band of ['bout_portant', 'courte', 'moyenne', 'longue', 'extreme']) {
    assert.ok(SHOTGUN_SPREAD_BY_BAND[band], `palier manquant : ${band}`)
  }
})
