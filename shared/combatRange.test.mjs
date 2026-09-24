import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseWeaponRangeBands, resolveWeaponRangeBand, resolveMeleeReachM,
  resolveShotgunSpread, resolveShotgunCone, SHOTGUN_SPREAD_BY_BAND,
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

// ─── resolveShotgunCone — tronc de cône RAW dérivé du tableau + ref_range (décision Saar 2026-09-24) ──
// Calibration sur la limite PROCHE des paliers (la première, sur la limite lointaine, a été rejetée par
// Saar à l'aperçu : ±0,15 m à 2 m). Klauss : (2 m, 1 m) et (14 m, 3 m) → pente 1/6, apex 4 m derrière le tireur.

const coneWidthAt = (cone, d) => Math.min(2 * (d + cone.apexBackM) * Math.tan(cone.angleDeg * Math.PI / 360), cone.capWidthM)

test('resolveShotgunCone — Klauss : 1 m à 2 m, 3 m dès 14 m, apex 4 m derrière le tireur, angle ≈ 9,53°', () => {
  const cone = resolveShotgunCone(KLAUSS_REF_RANGE)
  assert.equal(cone.capWidthM, 3)
  assert.equal(cone.lengthM, 35)
  assert.equal(cone.startM, 2)
  assert.equal(cone.capStartM, 14)
  assert.ok(Math.abs(cone.apexBackM - 4) < 1e-9)
  assert.ok(Math.abs(cone.angleDeg - 2 * Math.atan(1 / 12) * 180 / Math.PI) < 1e-9)
  assert.ok(Math.abs(cone.angleDeg - 9.53) < 0.01)
  assert.ok(Math.abs(coneWidthAt(cone, 2) - 1) < 1e-9)
  assert.ok(Math.abs(coneWidthAt(cone, 14) - 3) < 1e-9)
  assert.equal(coneWidthAt(cone, 30), 3) // plafonné
})

test('resolveShotgunCone — jamais plus étroit que le tableau RAW (tolérance 0,17 m à la frontière 7 m), au plus 1 m plus large', () => {
  const cone = resolveShotgunCone(KLAUSS_REF_RANGE)
  for (let d = 2.01; d <= 35; d += 0.25) {
    const table = resolveShotgunSpread(d, KLAUSS_REF_RANGE).spread.widthM
    const width = coneWidthAt(cone, d)
    assert.ok(width >= table - 0.17 - 1e-9, `d=${d} : ${width} ≥ ${table} - 0,17`)
    assert.ok(width <= table + 1 + 1e-9, `d=${d} : ${width} ≤ ${table} + 1`)
  }
})

test('resolveShotgunCone — portée inexploitable ou dégénérée : null, jamais une exception', () => {
  assert.equal(resolveShotgunCone(null), null)
  assert.equal(resolveShotgunCone(''), null)
  assert.equal(resolveShotgunCone('pas un nombre'), null)
  assert.equal(resolveShotgunCone('100'), null) // portée unique → seuils [0,0,0,0,100] : aucun point exploitable
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
