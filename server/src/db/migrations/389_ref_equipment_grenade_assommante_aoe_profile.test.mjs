import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './389_ref_equipment_grenade_assommante_aoe_profile.js'
import { GRENADE_THROW_RANGE } from '../../../../shared/combatRange.js'

// Lancement manuel : node --env-file=.env --test server/src/db/migrations/389_ref_equipment_grenade_assommante_aoe_profile.test.mjs
// Transaction systématiquement annulée (sentinelle ROLLBACK_MIGRATION_TEST, patron 385/384) : aucune
// écriture ne survit au test.
const skip = !process.env.DATABASE_URL

const NAME = 'Grenade assommante'
const EXPECTED_PROFILE = { shape: 'circle', mechanic: 'grenade_stun', radiusM: 2.5 }

test('round-trip — up() pose aoe_profile + shock_mechanism + range si tous null ; down() les remet à null', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const before = await trx('ref_equipment').where({ name: NAME })
      .select('id', 'category', 'shock', 'aoe_profile', 'shock_mechanism', 'range').first()
    assert.ok(before, 'précondition : la grenade assommante doit exister en base')
    assert.equal(before.category, 'Grenade')
    assert.equal(before.shock, '2D10')

    // Ramène les 3 colonnes à null pour ce test seulement — annulé avec le reste de la transaction.
    await trx('ref_equipment').where({ id: before.id }).update({ aoe_profile: null, shock_mechanism: null, range: null })

    await up(trx)

    const afterUp = await trx('ref_equipment').where({ id: before.id }).select('aoe_profile', 'shock_mechanism', 'range').first()
    assert.deepEqual(afterUp.aoe_profile, EXPECTED_PROFILE)
    assert.equal(afterUp.shock_mechanism, 'pure')
    assert.equal(afterUp.range, GRENADE_THROW_RANGE)

    await down(trx)

    const afterDown = await trx('ref_equipment').where({ id: before.id }).select('aoe_profile', 'shock_mechanism', 'range').first()
    assert.equal(afterDown.aoe_profile, null)
    assert.equal(afterDown.shock_mechanism, null)
    assert.equal(afterDown.range, null)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test('idempotence — up() ne remplace jamais une valeur déjà posée, colonne par colonne', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const before = await trx('ref_equipment').where({ name: NAME }).select('id').first()

    // Une seule des 3 colonnes déjà posée (valeur custom) — les 2 autres null : up() ne doit toucher
    // QUE celles qui sont null, jamais écraser celle déjà présente.
    await trx('ref_equipment').where({ id: before.id }).update({
      aoe_profile: JSON.stringify({ shape: 'circle', mechanic: 'grenade_stun', radiusM: 99 }),
      shock_mechanism: null, range: null,
    })
    await up(trx)

    const after = await trx('ref_equipment').where({ id: before.id }).select('aoe_profile', 'shock_mechanism', 'range').first()
    assert.deepEqual(after.aoe_profile, { shape: 'circle', mechanic: 'grenade_stun', radiusM: 99 }, 'aoe_profile déjà présent ne doit jamais être écrasé')
    assert.equal(after.shock_mechanism, 'pure', 'shock_mechanism était null, doit être posé')
    assert.equal(after.range, GRENADE_THROW_RANGE, 'range était null, doit être posé')

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
