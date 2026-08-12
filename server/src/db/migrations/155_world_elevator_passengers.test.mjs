import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './20260713_155_world_elevator_passengers.js'
import { assertTableExists, assertColumnsExist, assertConstraintExists } from './testHelpers/schemaAssertions.mjs'

const WORLD_ELEVATOR_PASSENGERS_COLUMNS = [
  'battlemap_id', 'elevator_id', 'token_id', 'local_position', 'boarded_at', 'updated_at',
]

// Tourne toujours, contrairement au test transactionnel ci-dessous (sauté dès que la migration a
// déjà tourné en dev) — détecte une dérive entre ce fichier et le schéma réel (SCHEMADRIFT-EXOTEMPLATES1,
// docs/JOURNAL8.md 2026-08-12).
test('schéma réel — world_elevator_passengers porte toutes les colonnes/contrainte de la migration 155', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertTableExists(db, 'world_elevator_passengers')
  await assertColumnsExist(db, 'world_elevator_passengers', WORLD_ELEVATOR_PASSENGERS_COLUMNS)
  await assertConstraintExists(db, 'world_elevator_passengers', 'chk_world_elevator_local_position')
})

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
