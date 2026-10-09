import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './385_ref_equipment_grenade_frag_throw_range.js'
import { GRENADE_THROW_RANGE } from '../../../../shared/combatRange.js'

// Lancement manuel : node --env-file=.env --test server/src/db/migrations/385_ref_equipment_grenade_frag_throw_range.test.mjs
// Transaction systématiquement annulée (sentinelle ROLLBACK_MIGRATION_TEST, même patron que
// 384_ref_equipment_remove_legacy_programmes.test.mjs) : aucune écriture ne survit au test.
const skip = !process.env.DATABASE_URL

const NAME = 'Grenade à fragmentation'

test('round-trip — up() pose GRENADE_THROW_RANGE si range est null ; down() le remet à null', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const before = await trx('ref_equipment').where({ name: NAME }).select('id', 'category', 'range').first()
    assert.ok(before, 'précondition : la grenade à fragmentation doit exister en base')
    assert.equal(before.category, 'Grenade')

    // Ramène range à null pour ce test seulement (comportement attendu avant cette migration),
    // même si une exécution précédente l'avait déjà posé — annulé avec le reste de la transaction.
    await trx('ref_equipment').where({ id: before.id }).update({ range: null })

    await up(trx)

    const afterUp = await trx('ref_equipment').where({ id: before.id }).select('range').first()
    assert.equal(afterUp.range, GRENADE_THROW_RANGE, 'up() doit écrire exactement la valeur de shared/combatRange.js#GRENADE_THROW_RANGE')

    await down(trx)

    const afterDown = await trx('ref_equipment').where({ id: before.id }).select('range').first()
    assert.equal(afterDown.range, null, 'down() doit remettre range à null')

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test('idempotence — up() ne remplace jamais une valeur déjà posée', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const before = await trx('ref_equipment').where({ name: NAME }).select('id').first()

    await trx('ref_equipment').where({ id: before.id }).update({ range: '1/1/1/1 (1)' })
    await up(trx)

    const after = await trx('ref_equipment').where({ id: before.id }).select('range').first()
    assert.equal(after.range, '1/1/1/1 (1)', 'une valeur déjà présente ne doit jamais être écrasée par up()')

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
