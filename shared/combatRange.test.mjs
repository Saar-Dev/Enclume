import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseWeaponRangeBands, resolveWeaponRangeBand, resolveMeleeReachM,
  resolveShotgunSpread, SHOTGUN_SPREAD_BY_BAND,
  GRENADE_FRAG_BANDS, GRENADE_FRAG_MAX_RADIUS_M, resolveGrenadeBand,
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

// isShotgunSpreadWeapon retiré (segment 0b) — l'identification AOE est dans shared/combatAoe.js
// (donnée `ref_equipment.aoe_profile`), testée dans shared/combatAoe.test.mjs.

// ─── Grenade à fragmentation — dégression par rayon (mécanisme grenade_frag, PLAN_GRENADES.md §10.2) ─
// Table déplacée ici depuis grenadeFrag.js (serveur) : l'aperçu client en a besoin aussi.

test('GRENADE_FRAG_BANDS — 5 paliers RAW, rayons = moitié du diamètre, triés croissants', () => {
  assert.deepEqual(GRENADE_FRAG_BANDS.map(b => b.name), ['centre', 'courte', 'moyenne', 'longue', 'extreme'])
  assert.deepEqual(GRENADE_FRAG_BANDS.map(b => b.maxDistanceM), [1, 2.5, 5, 10, 15])
})

test('GRENADE_FRAG_MAX_RADIUS_M — borne du dernier palier = radiusM figé par la migration 325', () => {
  assert.equal(GRENADE_FRAG_MAX_RADIUS_M, 15)
  assert.equal(GRENADE_FRAG_MAX_RADIUS_M, GRENADE_FRAG_BANDS[GRENADE_FRAG_BANDS.length - 1].maxDistanceM)
})

test('resolveGrenadeBand — bornes des paliers', () => {
  assert.equal(resolveGrenadeBand(0).name, 'centre')
  assert.equal(resolveGrenadeBand(1).name, 'centre')
  assert.equal(resolveGrenadeBand(1.01).name, 'courte')
  assert.equal(resolveGrenadeBand(2.5).name, 'courte')
  assert.equal(resolveGrenadeBand(2.51).name, 'moyenne')
  assert.equal(resolveGrenadeBand(5).name, 'moyenne')
  assert.equal(resolveGrenadeBand(5.01).name, 'longue')
  assert.equal(resolveGrenadeBand(10).name, 'longue')
  assert.equal(resolveGrenadeBand(10.01).name, 'extreme')
  assert.equal(resolveGrenadeBand(15).name, 'extreme')
  assert.equal(resolveGrenadeBand(999).name, 'extreme') // au-delà : dernier palier (exclusion faite en amont)
})

test('resolveGrenadeBand — charge utile RAW par palier (dés signés + Localisations + Test de Chance latent)', () => {
  assert.equal(resolveGrenadeBand(0.5).damageDice, '+1D10')
  assert.equal(resolveGrenadeBand(0.5).locationsDice, '1D3')
  assert.equal(resolveGrenadeBand(2).damageDice, '+0')
  assert.equal(resolveGrenadeBand(2).locationsDice, undefined) // 1 Localisation hors centre
  assert.equal(resolveGrenadeBand(4).damageDice, '-1D10')
  assert.equal(resolveGrenadeBand(8).damageDice, '-2D10')
  assert.equal(resolveGrenadeBand(8).chanceTest, true)
  assert.equal(resolveGrenadeBand(8).chanceBonus, 0)
  assert.equal(resolveGrenadeBand(13).damageDice, '-3D10')
  assert.equal(resolveGrenadeBand(13).chanceTest, true)
  assert.equal(resolveGrenadeBand(13).chanceBonus, 5)
})
