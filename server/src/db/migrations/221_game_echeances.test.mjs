import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './221_game_echeances.js'

test('migration 221 crée game_echeances avec ses contraintes et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('game_echeances')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    assert.equal(await trx.schema.hasTable('game_echeances'), true)
    for (const col of [
      'id', 'campaign_id', 'character_id', 'condition_type', 'interactive', 'payload',
      'next_due_minutes', 'interval_minutes', 'occurrences_remaining', 'status',
      'created_at', 'updated_at',
    ]) assert.equal(await trx.schema.hasColumn('game_echeances', col), true, `colonne ${col} absente`)

    await assert.rejects(
      trx.raw(`INSERT INTO game_echeances (campaign_id, character_id, condition_type, interactive, next_due_minutes, status)
                VALUES (gen_random_uuid(), gen_random_uuid(), 'test', true, 0, 'invalide')`),
      /chk_echeances_status/,
    )

    await down(trx)
    assert.equal(await trx.schema.hasTable('game_echeances'), false)
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
