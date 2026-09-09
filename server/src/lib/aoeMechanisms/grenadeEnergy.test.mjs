import test from 'node:test'
import assert from 'node:assert/strict'

// grenadeEnergy.js n'importe que circleGrenade.js (lui-même aoeShapes pur) — aucune requête à l'import.
import { grenadeEnergyMechanism } from './grenadeEnergy.js'
import { normalizeAoeShape } from '../../../../shared/world/aoeShapes.js'
import { createWorldMetrics } from '../../../../shared/world/worldMetrics.js'

const M = createWorldMetrics({ metersPerCell: 1, worldUnitsPerCell: 1 }) // 1 unité monde = 1 m
const cand = (over) => ({ hasLineOfSight: true, ...over })
const ORIGIN = { x: 0, y: 0, z: 0 }

test('grenadeEnergyMechanism — les 6 hooks + les 4 capacités de flux (grenade cercle)', () => {
  for (const hook of ['buildShape', 'filterTargets', 'extraTargets', 'targetRowModifier', 'computeTargetDamage', 'postResolve']) {
    assert.equal(typeof grenadeEnergyMechanism[hook], 'function', `${hook} doit être une fonction`)
  }
  assert.equal(grenadeEnergyMechanism.needsWeaponRange, false)
  assert.equal(grenadeEnergyMechanism.decrementsAmmo, false)
  assert.equal(grenadeEnergyMechanism.losSource, 'origin')
  assert.equal(grenadeEnergyMechanism.rollsPhaseA, false)
})

test('buildShape — cercle centré sur resolvedOrigin ; rayon depuis aoe_profile.radiusM, sinon repli 2,5 m', () => {
  const s1 = grenadeEnergyMechanism.buildShape({ aoe: { resolvedOrigin: { x: 1, y: 0, z: 2 } } })
  assert.equal(s1.shape, 'circle')
  assert.deepEqual(s1.origin, { x: 1, y: 0, z: 2 })
  assert.equal(s1.amplitudeM, 2.5) // repli fixture (migration 328 pose radiusM: 2.5)

  const s2 = grenadeEnergyMechanism.buildShape({
    aoe: { resolvedOrigin: ORIGIN },
    weapon: { ref_aoe_profile: { shape: 'circle', mechanic: 'grenade_energy', radiusM: 2.5 } },
  })
  assert.equal(s2.amplitudeM, 2.5)
})

test('buildShape — sans resolvedOrigin → lève', () => {
  assert.throws(() => grenadeEnergyMechanism.buildShape({ aoe: {} }))
})

test('filterTargets — LOS + dans le rayon de ctx.aoeShape ; aucun enrichissement (pas de palier)', () => {
  const ctx = { aoeShape: normalizeAoeShape({ shape: 'circle', origin: ORIGIN, amplitudeM: 2.5 }), metrics: M }
  const out = grenadeEnergyMechanism.filterTargets(ctx, [
    cand({ tokenId: 'in', position: { x: 2, y: 0, z: 0 }, distanceToOriginM: 2 }),
    cand({ tokenId: 'edge', position: { x: 2.5, y: 0, z: 0 }, distanceToOriginM: 2.5 }),
    cand({ tokenId: 'out', position: { x: 3, y: 0, z: 0 }, distanceToOriginM: 3 }),
    cand({ tokenId: 'blind', position: { x: 1, y: 0, z: 0 }, distanceToOriginM: 1, hasLineOfSight: false }),
  ])
  assert.deepEqual(out.map(t => t.tokenId).sort(), ['edge', 'in'])
  assert.equal(out[0].band, undefined) // uniforme — aucun palier
})

test('computeTargetDamage — dégât uniforme = baseRaw tel quel, 1 Localisation, armure normale', () => {
  const r = grenadeEnergyMechanism.computeTargetDamage({ rollResult: { mr: -9 } }, { tokenId: 'a' }, { baseRaw: 47 })
  assert.equal(r.degautsBruts, 47) // aucun dé de dégression, ctx.rollResult.mr jamais lu
  assert.equal(r.locationsCount, 1)
  assert.equal(r.armorReductionFactor, 1)
})

test('extraTargets / targetRowModifier / postResolve — no-ops (champ d\'énergie pur)', () => {
  assert.deepEqual(grenadeEnergyMechanism.extraTargets({}, [{ tokenId: 'a' }]), [])
  assert.equal(grenadeEnergyMechanism.targetRowModifier({ tokenId: 'a' }), null)
  assert.deepEqual(grenadeEnergyMechanism.postResolve(), [])
})
