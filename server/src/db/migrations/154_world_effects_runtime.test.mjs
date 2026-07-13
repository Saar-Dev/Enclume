import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './20260713_154_world_effects_runtime.js'

test('migration 154 effectue un aller-retour transactionnel sans toucher la base durable', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('world_effect_definitions')
  if (alreadyApplied) return
  const zonesBefore = await db.schema.hasTable('zones')
  const legacyBefore = await db.schema.hasTable('legacy_zones')

  await assert.rejects(db.transaction(async trx => {
    await up(trx)
    for (const table of [
      'world_effect_definitions',
      'world_feature_states',
      'world_effect_instances',
      'world_effect_events',
    ]) assert.equal(await trx.schema.hasTable(table), true, `${table} absente après up`)
    if (zonesBefore) assert.equal(await trx.schema.hasTable('legacy_zones'), true)

    await down(trx)
    assert.equal(await trx.schema.hasTable('world_effect_definitions'), false)
    assert.equal(await trx.schema.hasTable('zones'), zonesBefore)
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)

  assert.equal(await db.schema.hasTable('zones'), zonesBefore)
  assert.equal(await db.schema.hasTable('legacy_zones'), legacyBefore)
})

test.after(async () => { await db.destroy() })
