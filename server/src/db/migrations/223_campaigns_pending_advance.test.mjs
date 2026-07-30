import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './223_campaigns_pending_advance.js'

test('migration 223 ajoute les colonnes pending_advance_* et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('campaigns', 'pending_advance_delta_minutes')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    assert.equal(await trx.schema.hasColumn('campaigns', 'pending_advance_delta_minutes'), true)
    assert.equal(await trx.schema.hasColumn('campaigns', 'pending_advance_undo_log'), true)

    await down(trx)
    assert.equal(await trx.schema.hasColumn('campaigns', 'pending_advance_delta_minutes'), false)
    assert.equal(await trx.schema.hasColumn('campaigns', 'pending_advance_undo_log'), false)
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
