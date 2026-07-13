import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './20260713_157_entity_ranges_meters.js'

test('migration 157 convertit les portees d interaction en metres et revient sans perte', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assert.rejects(db.transaction(async trx => {
    const before = await trx('entity_blueprints').select('id', 'interactions').orderBy('id')
    await up(trx)
    const after = await trx('entity_blueprints').select('id', 'interactions').orderBy('id')
    for (let rowIndex = 0; rowIndex < before.length; rowIndex++) {
      for (let interactionIndex = 0; interactionIndex < (before[rowIndex].interactions || []).length; interactionIndex++) {
        const initial = before[rowIndex].interactions[interactionIndex]
        const converted = after[rowIndex].interactions[interactionIndex]
        if (typeof initial.range === 'number') assert.equal(converted.range, initial.range * 1.5)
      }
    }
    await down(trx)
    const restored = await trx('entity_blueprints').select('id', 'interactions').orderBy('id')
    assert.deepEqual(restored, before)
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
