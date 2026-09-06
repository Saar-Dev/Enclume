import test from 'node:test'
import assert from 'node:assert/strict'

// grenadeFrag.js importe parseDice/rollSignedDie (server/src/lib/diceParser.js) + aoeShapes/distanceBands
// (shared, purs) — aucune requête à l'import, même discipline que registry.test.mjs / socketCombatAoe.test.mjs.
import {
  grenadeFragMechanism,
  filterGrenadeFragHitTargets,
  resolveGrenadeBand,
  GRENADE_FRAG_MAX_RADIUS_M,
} from './grenadeFrag.js'
import { normalizeAoeShape } from '../../../../shared/world/aoeShapes.js'
import { createWorldMetrics } from '../../../../shared/world/worldMetrics.js'

const M = createWorldMetrics({ metersPerCell: 1, worldUnitsPerCell: 1 }) // 1 unité monde = 1 m
const cand = (over) => ({ hasLineOfSight: true, ...over })

// ─── Table de dégression ──────────────────────────────────────────────────────────────────────────

test('GRENADE_FRAG_MAX_RADIUS_M — rayon max = borne du dernier palier (une seule source de vérité)', () => {
  assert.equal(GRENADE_FRAG_MAX_RADIUS_M, 15)
})

test('resolveGrenadeBand — bornes des paliers (RAW : diamètre → rayon = moitié)', () => {
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
})

test('resolveGrenadeBand — charge utile RAW par palier (dés de dégression + Localisations + Test de Chance latent)', () => {
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

// ─── Ciblage pur ──────────────────────────────────────────────────────────────────────────────────

const ORIGIN = { x: 0, y: 0, z: 0 }
const BASE = { origin: ORIGIN, metrics: M }

test('filterGrenadeFragHitTargets — hors LOS exclu', () => {
  const out = filterGrenadeFragHitTargets({ ...BASE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: 3, y: 0, z: 0 }, distanceToOriginM: 3, hasLineOfSight: false }),
  ] })
  assert.equal(out.length, 0)
})

test('filterGrenadeFragHitTargets — au-delà du rayon max (> 15 m) exclu, resolveGrenadeBand jamais appelé', () => {
  const out = filterGrenadeFragHitTargets({ ...BASE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: 16, y: 0, z: 0 }, distanceToOriginM: 16 }),
    cand({ tokenId: 'b', position: { x: 15, y: 0, z: 0 }, distanceToOriginM: 15 }), // pile sur la borne → inclus
  ] })
  assert.deepEqual(out.map(t => t.tokenId), ['b'])
  assert.equal(out[0].band, 'extreme')
})

test('filterGrenadeFragHitTargets — le lanceur pris dans le souffle EST une cible (dispersion, PLAN_AOE §5.5)', () => {
  const out = filterGrenadeFragHitTargets({ ...BASE, visibilityTargets: [
    cand({ tokenId: 'thrower', position: { x: 0.5, y: 0, z: 0 }, distanceToOriginM: 0.5 }),
  ] })
  assert.equal(out.length, 1)
  assert.equal(out[0].tokenId, 'thrower')
  assert.equal(out[0].band, 'centre')
})

test('filterGrenadeFragHitTargets — cibles à distances variées : band + frag corrects, hauteur (y) ignorée', () => {
  const out = filterGrenadeFragHitTargets({ ...BASE, visibilityTargets: [
    cand({ tokenId: 'c', position: { x: 0.5, y: 9, z: 0 }, distanceToOriginM: 0.5 }),  // centre (y ignoré)
    cand({ tokenId: 'm', position: { x: 3, y: 0, z: 0 }, distanceToOriginM: 3 }),      // moyenne
    cand({ tokenId: 'e', position: { x: 0, y: 0, z: 12 }, distanceToOriginM: 12 }),    // extrême
  ] })
  assert.equal(out.length, 3)
  assert.equal(out.find(t => t.tokenId === 'c').band, 'centre')
  assert.equal(out.find(t => t.tokenId === 'c').frag.damageDice, '+1D10')
  assert.equal(out.find(t => t.tokenId === 'm').band, 'moyenne')
  assert.equal(out.find(t => t.tokenId === 'm').frag.damageDice, '-1D10')
  assert.equal(out.find(t => t.tokenId === 'e').band, 'extreme')
  assert.equal(out.find(t => t.tokenId === 'e').frag.damageDice, '-3D10')
})

test('filterGrenadeFragHitTargets — aucun candidat → tableau vide, jamais un throw', () => {
  assert.deepEqual(filterGrenadeFragHitTargets({ ...BASE, visibilityTargets: [] }), [])
})

// ─── Contrat de mécanisme ─────────────────────────────────────────────────────────────────────────

test('grenadeFragMechanism — les 6 hooks sont des fonctions + losSource origin (LOS depuis le point d\'impact)', () => {
  for (const hook of ['buildShape', 'filterTargets', 'extraTargets', 'targetRowModifier', 'computeTargetDamage', 'postResolve']) {
    assert.equal(typeof grenadeFragMechanism[hook], 'function', `${hook} doit être une fonction`)
  }
  assert.equal(grenadeFragMechanism.losSource, 'origin')
})

test('grenadeFragMechanism.buildShape — cercle centré sur ctx.aoe.resolvedOrigin, rayon = max', () => {
  const shape = grenadeFragMechanism.buildShape({ aoe: { resolvedOrigin: { x: 3, y: 0, z: 4 } } })
  assert.equal(shape.shape, 'circle')
  assert.deepEqual(shape.origin, { x: 3, y: 0, z: 4 })
  assert.equal(shape.amplitudeM, GRENADE_FRAG_MAX_RADIUS_M)
})

test('grenadeFragMechanism.buildShape — sans resolvedOrigin → lève (l\'orchestrateur doit toujours le poser)', () => {
  assert.throws(() => grenadeFragMechanism.buildShape({ aoe: {} }))
})

test('grenadeFragMechanism.filterTargets — adapte ctx.aoeShape/ctx.metrics vers la fonction pure', () => {
  const ctx = {
    aoeShape: normalizeAoeShape({ shape: 'circle', origin: ORIGIN, amplitudeM: GRENADE_FRAG_MAX_RADIUS_M }),
    metrics: M,
  }
  const out = grenadeFragMechanism.filterTargets(ctx, [
    cand({ tokenId: 'a', position: { x: 4, y: 0, z: 0 }, distanceToOriginM: 4 }),
    cand({ tokenId: 'far', position: { x: 20, y: 0, z: 0 }, distanceToOriginM: 20 }),
  ])
  assert.deepEqual(out.map(t => t.tokenId), ['a'])
  assert.equal(out[0].band, 'moyenne')
})

test('grenadeFragMechanism.extraTargets / postResolve — toujours [] (fragmentation pure)', () => {
  assert.deepEqual(grenadeFragMechanism.extraTargets({}, []), [])
  assert.deepEqual(grenadeFragMechanism.postResolve(), [])
})

test('grenadeFragMechanism.targetRowModifier — { band, damageDice } (miroir shotgun_spread)', () => {
  const ht = { band: 'moyenne', frag: resolveGrenadeBand(4) }
  assert.deepEqual(grenadeFragMechanism.targetRowModifier(ht), { band: 'moyenne', damageDice: '-1D10' })
})

// ─── Dégât par cible ──────────────────────────────────────────────────────────────────────────────

test('grenadeFragMechanism.computeTargetDamage — centre : baseRaw + (+1D10), 1D3 Localisations, armure normale', async () => {
  const ht = { band: 'centre', frag: resolveGrenadeBand(0.5) }
  for (let i = 0; i < 40; i += 1) {
    const r = await grenadeFragMechanism.computeTargetDamage({}, ht, { baseRaw: 100 })
    assert.ok(r.degautsBruts >= 101 && r.degautsBruts <= 110, `centre hors bornes : ${r.degautsBruts}`)
    assert.ok([1, 2, 3].includes(r.locationsCount), `1D3 attendu : ${r.locationsCount}`)
    assert.equal(r.armorReductionFactor, 1)
  }
})

test('grenadeFragMechanism.computeTargetDamage — extrême : baseRaw + (-3D10), 1 Localisation', async () => {
  const ht = { band: 'extreme', frag: resolveGrenadeBand(13) }
  for (let i = 0; i < 40; i += 1) {
    const r = await grenadeFragMechanism.computeTargetDamage({}, ht, { baseRaw: 100 })
    assert.ok(r.degautsBruts >= 70 && r.degautsBruts <= 97, `extrême hors bornes : ${r.degautsBruts}`)
    assert.equal(r.locationsCount, 1)
  }
})

test('grenadeFragMechanism.computeTargetDamage — courte : baseRaw inchangé (+0), aucune contribution mr/fireMode', async () => {
  const ht = { band: 'courte', frag: resolveGrenadeBand(2) }
  const r = await grenadeFragMechanism.computeTargetDamage({ rollResult: { mr: -12 } }, ht, { baseRaw: 42 })
  assert.equal(r.degautsBruts, 42) // ctx.rollResult.mr jamais lu
  assert.equal(r.locationsCount, 1)
})
