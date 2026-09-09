import test from 'node:test'
import assert from 'node:assert/strict'

// Registre AOE (Segment 1.5) — importe transitivement db/knex (via shotgunSpread.js/flamethrower.js,
// eux-mêmes important environmentalHazardService.js) mais n'exécute aucune requête à l'import, même
// discipline que socketCombatAoe.test.mjs (le module ne se connecte qu'au premier appel réel).
import { AOE_MECHANISM_REGISTRY, findAoeMechanismEntry } from './registry.js'

test('findAoeMechanismEntry — les mécanismes câblés sont enregistrés, chacun avec les 6 hooks', () => {
  for (const key of ['shotgun_spread', 'flamethrower', 'grenade_frag', 'grenade_energy']) {
    const entry = findAoeMechanismEntry(key)
    assert.ok(entry, `entrée "${key}" absente du registre`)
    assert.equal(entry.key, key)
    for (const hook of ['buildShape', 'filterTargets', 'extraTargets', 'targetRowModifier', 'computeTargetDamage', 'postResolve']) {
      assert.equal(typeof entry[hook], 'function', `${key}.${hook} doit être une fonction`)
    }
  }
})

test('findAoeMechanismEntry — mécanisme inconnu → undefined, jamais un throw', () => {
  assert.equal(findAoeMechanismEntry('grenade_circle'), undefined)
  assert.equal(findAoeMechanismEntry(null), undefined)
  assert.equal(findAoeMechanismEntry(undefined), undefined)
})

test('AOE_MECHANISM_REGISTRY — 4 entrées, clés uniques (fusil à pompe + lance-flammes + grenade frag + grenade énergie)', () => {
  assert.equal(AOE_MECHANISM_REGISTRY.length, 4)
  const keys = AOE_MECHANISM_REGISTRY.map(e => e.key)
  assert.equal(new Set(keys).size, keys.length)
})

test('capacités de flux — les grenades cercle s\'écartent des défauts (needsWeaponRange/decrementsAmmo/losSource/rollsPhaseA), les cônes/rayons non', () => {
  for (const key of ['grenade_frag', 'grenade_energy']) {
    const g = findAoeMechanismEntry(key)
    assert.equal(g.needsWeaponRange, false, `${key} : amplitude depuis le mécanisme, pas ref_range`)
    assert.equal(g.decrementsAmmo, false, `${key} : consommée au lancer, pas à l'explosion`)
    assert.equal(g.losSource, 'origin', `${key} : LOS depuis le point d'impact`)
    assert.equal(g.rollsPhaseA, false, `${key} : Test de Coordination fait au LANCER (§3d), pas à l'explosion`)
  }

  for (const key of ['shotgun_spread', 'flamethrower']) {
    const m = findAoeMechanismEntry(key)
    assert.equal(m.needsWeaponRange, undefined) // → défaut true (comportement historique)
    assert.equal(m.decrementsAmmo, undefined)   // → défaut true
    assert.equal(m.losSource, undefined)        // → défaut 'caster'
    assert.equal(m.rollsPhaseA, undefined)      // → défaut true
  }
})

// extraTargets par défaut (fusil à pompe) : jamais de pseudo-cible — vérifie le contrat générique que
// le tronc utilise pour poser `ctx.hadExtraTargets` (aucune signature DB requise, mais l'appel se fait
// avec un ctx minimal réaliste).
test('shotgun_spread.extraTargets — toujours [] (aucune auto-éclaboussure RAW pour une gerbe de plombs)', () => {
  const mech = findAoeMechanismEntry('shotgun_spread')
  const ctx = { action: { token_id: 'shooter' } }
  assert.deepEqual(mech.extraTargets(ctx, [{ tokenId: 'a', distanceToOriginM: 1 }]), [])
})

test('flamethrower.extraTargets — pseudo-cible tireur si une autre cible touchée est à < 3 m, sinon []', () => {
  const mech = findAoeMechanismEntry('flamethrower')
  const ctx = { action: { token_id: 'shooter' }, aoeShape: { origin: { x: 0, y: 0, z: 0 } } }
  assert.deepEqual(mech.extraTargets(ctx, [{ tokenId: 'a', distanceToOriginM: 5 }]), [])
  const withSplash = mech.extraTargets(ctx, [{ tokenId: 'a', distanceToOriginM: 2 }])
  assert.equal(withSplash.length, 1)
  assert.equal(withSplash[0].tokenId, 'shooter')
  assert.equal(withSplash[0].isSelfSplash, true)
})

test('shotgun_spread.targetRowModifier — porte le palier + le dé de dispersion de la cible', () => {
  const mech = findAoeMechanismEntry('shotgun_spread')
  const mod = mech.targetRowModifier({ band: 'moyenne', spread: { damageDice: '-1D10' } })
  assert.deepEqual(mod, { band: 'moyenne', damageDice: '-1D10' })
})

test('flamethrower.targetRowModifier — toujours null (aucune dispersion RAW)', () => {
  const mech = findAoeMechanismEntry('flamethrower')
  assert.equal(mech.targetRowModifier({ band: null }), null)
})
