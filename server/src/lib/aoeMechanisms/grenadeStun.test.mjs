import test from 'node:test'
import assert from 'node:assert/strict'

// grenadeStun.js n'importe que circleGrenade.js (lui-même aoeShapes pur) — aucune requête à l'import.
import { grenadeStunMechanism } from './grenadeStun.js'
import { normalizeAoeShape } from '../../../../shared/world/aoeShapes.js'
import { createWorldMetrics } from '../../../../shared/world/worldMetrics.js'

const M = createWorldMetrics({ metersPerCell: 1, worldUnitsPerCell: 1 }) // 1 unité monde = 1 m
const cand = (over) => ({ hasLineOfSight: true, ...over })
const ORIGIN = { x: 0, y: 0, z: 0 }

test('grenadeStunMechanism — les 6 hooks + les 4 capacités de flux (grenade cercle)', () => {
  for (const hook of ['buildShape', 'filterTargets', 'extraTargets', 'targetRowModifier', 'computeTargetDamage', 'postResolve']) {
    assert.equal(typeof grenadeStunMechanism[hook], 'function', `${hook} doit être une fonction`)
  }
  assert.equal(grenadeStunMechanism.needsWeaponRange, false)
  assert.equal(grenadeStunMechanism.decrementsAmmo, false)
  assert.equal(grenadeStunMechanism.losSource, 'origin')
  assert.equal(grenadeStunMechanism.rollsPhaseA, false)
})

test('buildShape — cercle centré sur resolvedOrigin ; rayon depuis aoe_profile.radiusM, sinon repli 2,5 m', () => {
  const s1 = grenadeStunMechanism.buildShape({ aoe: { resolvedOrigin: { x: 1, y: 0, z: 2 } } })
  assert.equal(s1.shape, 'circle')
  assert.deepEqual(s1.origin, { x: 1, y: 0, z: 2 })
  assert.equal(s1.amplitudeM, 2.5) // repli fixture (migration 389 pose radiusM: 2.5)

  const s2 = grenadeStunMechanism.buildShape({
    aoe: { resolvedOrigin: ORIGIN },
    weapon: { ref_aoe_profile: { shape: 'circle', mechanic: 'grenade_stun', radiusM: 2.5 } },
  })
  assert.equal(s2.amplitudeM, 2.5)
})

test('buildShape — sans resolvedOrigin → lève', () => {
  assert.throws(() => grenadeStunMechanism.buildShape({ aoe: {} }))
})

test('filterTargets — LOS + dans le rayon de ctx.aoeShape ; aucun enrichissement (pas de palier)', () => {
  const ctx = { aoeShape: normalizeAoeShape({ shape: 'circle', origin: ORIGIN, amplitudeM: 2.5 }), metrics: M }
  const out = grenadeStunMechanism.filterTargets(ctx, [
    cand({ tokenId: 'in', position: { x: 2, y: 0, z: 0 }, distanceToOriginM: 2 }),
    cand({ tokenId: 'edge', position: { x: 2.5, y: 0, z: 0 }, distanceToOriginM: 2.5 }),
    cand({ tokenId: 'out', position: { x: 3, y: 0, z: 0 }, distanceToOriginM: 3 }),
    cand({ tokenId: 'blind', position: { x: 1, y: 0, z: 0 }, distanceToOriginM: 1, hasLineOfSight: false }),
  ])
  assert.deepEqual(out.map(t => t.tokenId).sort(), ['edge', 'in'])
  assert.equal(out[0].band, undefined) // uniforme — aucun palier
})

test('computeTargetDamage — dégât uniforme = baseRaw tel quel (1D6 préparé par l\'orchestrateur), 1 Localisation, armure normale', () => {
  const r = grenadeStunMechanism.computeTargetDamage({ rollResult: { mr: -9 } }, { tokenId: 'a' }, { baseRaw: 4 })
  assert.equal(r.degautsBruts, 4) // aucun dé de dégression, ctx.rollResult.mr jamais lu
  assert.equal(r.locationsCount, 1)
  assert.equal(r.armorReductionFactor, 1)
})

test('extraTargets / targetRowModifier / postResolve — no-ops (le Choc est résolu par le tronc, pas ici)', () => {
  assert.deepEqual(grenadeStunMechanism.extraTargets({}, [{ tokenId: 'a' }]), [])
  assert.equal(grenadeStunMechanism.targetRowModifier({ tokenId: 'a' }), null)
  assert.deepEqual(grenadeStunMechanism.postResolve(), [])
})
