import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './234_pending_catastrophes.js'

test('migration 234 crée pending_catastrophes avec ses colonnes et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('pending_catastrophes')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    assert.equal(await trx.schema.hasTable('pending_catastrophes'), true)
    for (const column of [
      'id', 'campaign_id', 'token_id', 'table_entry', 'applied_entry',
      'context', 'rolled_at', 'resolved_at', 'resolved_by',
    ]) {
      assert.equal(await trx.schema.hasColumn('pending_catastrophes', column), true, `colonne manquante: ${column}`)
    }

    await down(trx)
    assert.equal(await trx.schema.hasTable('pending_catastrophes'), false)
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
