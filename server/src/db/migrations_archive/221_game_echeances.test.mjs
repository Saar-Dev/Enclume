import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './221_game_echeances.js'
import { assertTableExists, assertColumnsExist, assertConstraintExists } from './testHelpers/schemaAssertions.mjs'

const GAME_ECHEANCES_COLUMNS = [
  'id', 'campaign_id', 'character_id', 'condition_type', 'interactive', 'payload',
  'next_due_minutes', 'interval_minutes', 'occurrences_remaining', 'status',
  'created_at', 'updated_at',
]

// Tourne toujours, contrairement au test transactionnel ci-dessous (sauté dès que la migration a
// déjà tourné en dev) — détecte une dérive entre ce fichier et le schéma réel (SCHEMADRIFT-EXOTEMPLATES1,
// docs/JOURNAL8.md 2026-08-12).
test('schéma réel — game_echeances porte toutes les colonnes/contrainte de la migration 221', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertTableExists(db, 'game_echeances')
  await assertColumnsExist(db, 'game_echeances', GAME_ECHEANCES_COLUMNS)
  await assertConstraintExists(db, 'game_echeances', 'chk_echeances_status')
})

test('migration 221 crée game_echeances avec ses contraintes et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('game_echeances')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    assert.equal(await trx.schema.hasTable('game_echeances'), true)
    for (const col of GAME_ECHEANCES_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('game_echeances', col), true, `colonne ${col} absente`)
    }

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
