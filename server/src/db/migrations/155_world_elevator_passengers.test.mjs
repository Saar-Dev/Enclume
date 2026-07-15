import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './20260713_155_world_elevator_passengers.js'

test('migration 155 effectue un aller-retour transactionnel sans toucher la base durable', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('world_elevator_passengers')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async trx => {
    await up(trx)
    assert.equal(await trx.schema.hasTable('world_elevator_passengers'), true)
    await down(trx)
    assert.equal(await trx.schema.hasTable('world_elevator_passengers'), false)
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)

  assert.equal(await db.schema.hasTable('world_elevator_passengers'), false)
})

test.after(async () => { await db.destroy() })
