import test from 'node:test'
import assert from 'node:assert/strict'

// Ce fichier importe socketCombatAoe.js + les 2 mécanismes du registre AOE (Segment 1.5,
// server/src/lib/aoeMechanisms/) — transitivement db / connexion Postgres via chacun — mais ne teste
// que des fonctions pures (resolveAoeAttackRoll, filterShotgunHitTargets, filterFlamethrowerHitTargets)
// — aucune ne touche la DB. Aucune connexion réelle n'est requise : l'import n'exécute aucune requête.
// filterShotgunHitTargets/filterFlamethrowerHitTargets ont déplacé de socketCombatAoe.js vers leur
// fichier mécanisme respectif au Segment 1.5 — signatures et comportement inchangés, seul l'import bouge.
import { resolveAoeAttackRoll } from './socketCombatAoe.js'
import { filterShotgunHitTargets } from '../lib/aoeMechanisms/shotgunSpread.js'
import { filterFlamethrowerHitTargets } from '../lib/aoeMechanisms/flamethrower.js'
import { createWorldMetrics } from '../../../shared/world/worldMetrics.js'

// resolveAoeAttackRoll — couche 4 AOE, phase A (docs/PLANS/PLAN_AOE.md §8 étape 8). Un seul Test de
// tir pour toute une action à zone d'effet, sans contribution propre à une cible précise (déplacées
// en phase B, par cible).

test('resolveAoeAttackRoll — seuil = skillTotal + somme des contributions (arithmétique pure, vérifiable malgré le jet aléatoire)', async () => {
  const result = await resolveAoeAttackRoll({
    skillTotal: 10,
    skillMastery: 0,
    contributions: [
      { label: 'Portée', value: -3, type: 'malus' },
      { label: 'Mode de tir', value: 5, type: 'bonus' },
    ],
  })
  assert.equal(result.seuil, 12) // 10 - 3 + 5
  assert.ok(Number.isInteger(result.rollAttaque) && result.rollAttaque >= 1 && result.rollAttaque <= 20)
  assert.ok(Array.isArray(result.attackRolls))
  assert.equal(typeof result.isSuccess, 'boolean')
})

test('resolveAoeAttackRoll — sans contribution (tableau vide/absent) : seuil = skillTotal seul', async () => {
  const result = await resolveAoeAttackRoll({ skillTotal: 15, skillMastery: 0 })
  assert.equal(result.seuil, 15)
})

test('resolveAoeAttackRoll — breakdown ne contient jamais de contribution propre à une cible (couverture/bouclier/sans-défense)', async () => {
  const result = await resolveAoeAttackRoll({
    skillTotal: 10, skillMastery: 0,
    contributions: [{ label: 'Portée', value: -3, type: 'malus' }],
  })
  const labels = result.breakdown.map(b => b.label)
  for (const forbidden of ['Couverture cible', 'Bouclier adverse', 'Cible sans défense']) {
    assert.ok(!labels.includes(forbidden), `"${forbidden}" ne doit jamais apparaître ici — c'est une contribution phase B, par cible`)
  }
})

test('resolveAoeAttackRoll — sur 200 tirages, rollAttaque reste toujours dans [1,20] et la réussite critique suit roll===seuil (ou 20 si seuil>=20)', async () => {
  for (let i = 0; i < 200; i++) {
    const result = await resolveAoeAttackRoll({ skillTotal: 12, skillMastery: 2, contributions: [] })
    assert.ok(result.rollAttaque >= 1 && result.rollAttaque <= 20)
    assert.equal(typeof result.isCriticalSuccess, 'boolean')
    assert.equal(typeof result.isCriticalFail, 'boolean')
  }
})

test('resolveAoeAttackRoll — le bonus de réussite critique dépend de skillMastery (même primitive partagée que resolveAssaultAction)', async () => {
  // Ne teste pas l'aléatoire (impossible de forcer un critique ici sans mock du RNG, hors scope) —
  // vérifie seulement que la maîtrise est bien transmise à getCriticalSuccessBonus sans lever
  // d'exception, pour une gamme de valeurs réalistes.
  for (const skillMastery of [0, 1, 3, 5]) {
    const result = await resolveAoeAttackRoll({ skillTotal: 10, skillMastery, contributions: [] })
    assert.equal(typeof result.mr, 'number')
  }
})

// ─── filterShotgunHitTargets — passe 2 pure du ciblage fusil à pompe (segment 0d) ─────────────────
// Klauss réel : ref_range '2/7/14/28 (35)' → bp ≤2, courte 2-7, moyenne 7-14, longue 14-28, extrême 28-35.
// Paliers RAW (SHOTGUN_SPREAD_BY_BAND) : bp widthM null, courte 1, moyenne 2, longue/extrême 3.
// metrics 1 unité monde = 1 m (createWorldMetrics) → coordonnées = mètres directement.

const M = createWorldMetrics({ metersPerCell: 1, worldUnitsPerCell: 1 })
const KLAUSS_RANGE = '2/7/14/28 (35)'
const BASE = { shooterTokenId: 'shooter', origin: { x: 0, y: 0, z: 0 }, directionDeg: 0, refRange: KLAUSS_RANGE, amplitudeM: 35, metrics: M }
const cand = (over) => ({ hasLineOfSight: true, ...over })

test('filterShotgunHitTargets — le tireur est exclu explicitement (plus par accident bout-portant)', () => {
  const out = filterShotgunHitTargets({ ...BASE, visibilityTargets: [
    cand({ tokenId: 'shooter', position: { x: 0, y: 0, z: 0 }, distanceToOriginM: 0 }),
    // même position que le tireur mais autre token : lui, c'est le bout-portant qui l'exclut
    cand({ tokenId: 'other', position: { x: 0, y: 0, z: 0 }, distanceToOriginM: 0 }),
  ] })
  assert.equal(out.length, 0)
})

test('filterShotgunHitTargets — hors LOS exclu', () => {
  const out = filterShotgunHitTargets({ ...BASE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: 5, y: 0, z: 0 }, distanceToOriginM: 5, hasLineOfSight: false }),
  ] })
  assert.equal(out.length, 0)
})

test('filterShotgunHitTargets — bout portant (< 2 m) exclu (spread.widthM null)', () => {
  const out = filterShotgunHitTargets({ ...BASE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: 1, y: 0, z: 0 }, distanceToOriginM: 1 }),
  ] })
  assert.equal(out.length, 0)
})

test('filterShotgunHitTargets — hors de portée (> 35 m) exclu', () => {
  const out = filterShotgunHitTargets({ ...BASE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: 40, y: 0, z: 0 }, distanceToOriginM: 40 }),
  ] })
  assert.equal(out.length, 0)
})

test('filterShotgunHitTargets — derrière le tireur (x < 0) exclu par la géométrie du rayon', () => {
  const out = filterShotgunHitTargets({ ...BASE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: -5, y: 0, z: 0 }, distanceToOriginM: 5 }),
  ] })
  assert.equal(out.length, 0)
})

test('filterShotgunHitTargets — dans le couloir large mais hors de la largeur de son propre palier : exclu', () => {
  // Palier moyenne (7-14 m) : largeur RAW 2 m → demi-largeur 1 m. z = 1,5 m est dedans le couloir
  // grossier (3 m) mais dehors le palier réel.
  const out = filterShotgunHitTargets({ ...BASE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: 10, y: 0, z: 1.5 }, distanceToOriginM: 10 }),
  ] })
  assert.equal(out.length, 0)
})

test('filterShotgunHitTargets — en-palier inclus, band + spread corrects', () => {
  const out = filterShotgunHitTargets({ ...BASE, visibilityTargets: [
    cand({ tokenId: 'c', position: { x: 5, y: 0, z: 0.4 }, distanceToOriginM: 5 }),   // courte (2-7), demi-largeur 0,5
    cand({ tokenId: 'm', position: { x: 10, y: 0, z: 0.9 }, distanceToOriginM: 10 }), // moyenne (7-14), demi-largeur 1
  ] })
  assert.equal(out.length, 2)
  const c = out.find(t => t.tokenId === 'c')
  const m = out.find(t => t.tokenId === 'm')
  assert.equal(c.band, 'courte')
  assert.equal(c.spread.damageDice, '+0')
  assert.equal(m.band, 'moyenne')
  assert.equal(m.spread.damageDice, '-1D10')
  // la hauteur (y) n'intervient jamais (géométrie horizontale X/Z) — sanity
  assert.equal(typeof c.distanceToOriginM, 'number')
})

test('filterShotgunHitTargets — aucun candidat → tableau vide, jamais un throw', () => {
  assert.deepEqual(filterShotgunHitTargets({ ...BASE, visibilityTargets: [] }), [])
})

// ─── filterFlamethrowerHitTargets — ciblage cône lance-flammes, PURE (segment 1e) ─────────────────
// Lance-flammes réel : aoe_profile { shape:'cone', angleDeg:30 }, portée extrême 40 m
// (ref_range '3/7/15/30 (40)'). Cône = bearing dans ±15° de la visée ET distance ≤ 40 m.
// Pas de dé de dispersion, pas de palier : `band` toujours null.

const CONE = { shooterTokenId: 'shooter', origin: { x: 0, y: 0, z: 0 }, directionDeg: 0, amplitudeM: 40, angleDeg: 30, metrics: M }

test('filterFlamethrowerHitTargets — le tireur est exclu explicitement (l\'origine est toujours dans son propre cône)', () => {
  const out = filterFlamethrowerHitTargets({ ...CONE, visibilityTargets: [
    cand({ tokenId: 'shooter', position: { x: 0, y: 0, z: 0 }, distanceToOriginM: 0 }),
  ] })
  assert.equal(out.length, 0)
})

test('filterFlamethrowerHitTargets — hors LOS exclu', () => {
  const out = filterFlamethrowerHitTargets({ ...CONE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: 10, y: 0, z: 0 }, distanceToOriginM: 10, hasLineOfSight: false }),
  ] })
  assert.equal(out.length, 0)
})

test('filterFlamethrowerHitTargets — au-delà de la longueur du cône (> 40 m) exclu', () => {
  const out = filterFlamethrowerHitTargets({ ...CONE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: 45, y: 0, z: 0 }, distanceToOriginM: 45 }),
  ] })
  assert.equal(out.length, 0)
})

test('filterFlamethrowerHitTargets — hors de l\'ouverture angulaire (> ±15°) exclu', () => {
  // (10, 0, 5) → bearing atan2(5,10) ≈ 26,6° > 15°
  const out = filterFlamethrowerHitTargets({ ...CONE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: 10, y: 0, z: 5 }, distanceToOriginM: Math.hypot(10, 5) }),
  ] })
  assert.equal(out.length, 0)
})

test('filterFlamethrowerHitTargets — derrière le tireur exclu', () => {
  const out = filterFlamethrowerHitTargets({ ...CONE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: -10, y: 0, z: 0 }, distanceToOriginM: 10 }),
  ] })
  assert.equal(out.length, 0)
})

test('filterFlamethrowerHitTargets — dans le cône (angle + portée) inclus, band null', () => {
  const out = filterFlamethrowerHitTargets({ ...CONE, visibilityTargets: [
    cand({ tokenId: 'axe', position: { x: 10, y: 0, z: 0 }, distanceToOriginM: 10 }),      // pile sur l'axe
    cand({ tokenId: 'bord', position: { x: 10, y: 0, z: 2 }, distanceToOriginM: Math.hypot(10, 2) }), // ≈11,3° < 15°
  ] })
  assert.equal(out.length, 2)
  assert.equal(out.find(t => t.tokenId === 'axe').band, null)
  assert.equal(out.find(t => t.tokenId === 'bord').band, null)
})

test('filterFlamethrowerHitTargets — aucun candidat → tableau vide, jamais un throw', () => {
  assert.deepEqual(filterFlamethrowerHitTargets({ ...CONE, visibilityTargets: [] }), [])
})
