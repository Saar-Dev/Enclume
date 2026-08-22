import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './20260713_156_combat_world_plans.js'

test('migration 156 effectue un aller-retour transactionnel', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const exists = await db.schema.hasColumn('combat_actions', 'destination_world')
  if (exists) return
  await assert.rejects(db.transaction(async trx => {
    await up(trx)
    assert.equal(await trx.schema.hasColumn('combat_actions', 'destination_world'), true)
    assert.equal(await trx.schema.hasColumn('combat_actions', 'movement_gait'), true)
    await down(trx)
    assert.equal(await trx.schema.hasColumn('combat_actions', 'destination_world'), false)
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
