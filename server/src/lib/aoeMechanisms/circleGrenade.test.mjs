import test from 'node:test'
import assert from 'node:assert/strict'

// circleGrenade.js n'importe que aoeShapes (shared, pur) — aucune requête à l'import.
import {
  buildCircleShape, filterCircleHitTargets, CIRCLE_GRENADE_FLOW,
  noExtraTargets, noTargetRowModifier, noPostResolve,
} from './circleGrenade.js'
import { createWorldMetrics } from '../../../../shared/world/worldMetrics.js'

const M = createWorldMetrics({ metersPerCell: 1, worldUnitsPerCell: 1 }) // 1 unité monde = 1 m
const cand = (over) => ({ hasLineOfSight: true, ...over })
const ORIGIN = { x: 0, y: 0, z: 0 }

// ─── buildCircleShape ─────────────────────────────────────────────────────────────────────────────

test('buildCircleShape — cercle centré sur ctx.aoe.resolvedOrigin, rayon depuis aoe_profile.radiusM', () => {
  const s = buildCircleShape({
    aoe: { resolvedOrigin: { x: 3, y: 0, z: 4 } },
    weapon: { ref_aoe_profile: { shape: 'circle', mechanic: 'grenade_x', radiusM: 2.5 } },
  }, 99)
  assert.equal(s.shape, 'circle')
  assert.deepEqual(s.origin, { x: 3, y: 0, z: 4 })
  assert.equal(s.amplitudeM, 2.5) // le catalogue est l'autorité, jamais le fallback quand radiusM est là
})

test('buildCircleShape — sans radiusM catalogue → repli sur fallbackRadiusM (fixtures / ligne non migrée)', () => {
  assert.equal(buildCircleShape({ aoe: { resolvedOrigin: ORIGIN } }, 7).amplitudeM, 7)
})

test('buildCircleShape — sans resolvedOrigin → lève (l\'orchestrateur doit toujours le poser)', () => {
  assert.throws(() => buildCircleShape({ aoe: {} }, 5))
})

// ─── filterCircleHitTargets ───────────────────────────────────────────────────────────────────────

const FILTER_BASE = { origin: ORIGIN, amplitudeM: 5, metrics: M }

test('filterCircleHitTargets — hors LOS exclu', () => {
  assert.deepEqual(filterCircleHitTargets({ ...FILTER_BASE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: 2, y: 0, z: 0 }, distanceToOriginM: 2, hasLineOfSight: false }),
  ] }), [])
})

test('filterCircleHitTargets — hors du cercle exclu, sur la borne inclus, hauteur (y) ignorée', () => {
  const out = filterCircleHitTargets({ ...FILTER_BASE, visibilityTargets: [
    cand({ tokenId: 'in', position: { x: 3, y: 9, z: 0 }, distanceToOriginM: 3 }),
    cand({ tokenId: 'edge', position: { x: 5, y: 0, z: 0 }, distanceToOriginM: 5 }),
    cand({ tokenId: 'out', position: { x: 6, y: 0, z: 0 }, distanceToOriginM: 6 }),
  ] })
  assert.deepEqual(out.map(t => t.tokenId).sort(), ['edge', 'in'])
})

test('filterCircleHitTargets — le lanceur pris dans le souffle EST retenu (pas d\'exclusion, RAW PLAN_AOE §5.5)', () => {
  assert.deepEqual(filterCircleHitTargets({ ...FILTER_BASE, visibilityTargets: [
    cand({ tokenId: 'thrower', position: { x: 0.5, y: 0, z: 0 }, distanceToOriginM: 0.5 }),
  ] }).map(t => t.tokenId), ['thrower'])
})

test('filterCircleHitTargets — aucun enrichissement (contrairement à grenade_frag) ; [] jamais un throw', () => {
  assert.deepEqual(filterCircleHitTargets({ ...FILTER_BASE, visibilityTargets: [] }), [])
  const out = filterCircleHitTargets({ ...FILTER_BASE, visibilityTargets: [
    cand({ tokenId: 'a', position: { x: 1, y: 0, z: 0 }, distanceToOriginM: 1 }),
  ] })
  assert.equal(out.length, 1)
  assert.equal(out[0].band, undefined)
  assert.equal(out[0].frag, undefined)
})

// ─── flux + no-ops ───────────────────────────────────────────────────────────────────────────────

test('CIRCLE_GRENADE_FLOW — les 4 capacités communes aux grenades cercle, objet gelé', () => {
  assert.deepEqual({ ...CIRCLE_GRENADE_FLOW }, {
    needsWeaponRange: false, decrementsAmmo: false, losSource: 'origin', rollsPhaseA: false,
  })
  assert.throws(() => { CIRCLE_GRENADE_FLOW.losSource = 'caster' })
})

test('no-ops nommés — extraTargets [] / targetRowModifier null / postResolve []', () => {
  assert.deepEqual(noExtraTargets(), [])
  assert.equal(noTargetRowModifier(), null)
  assert.deepEqual(noPostResolve(), [])
})
