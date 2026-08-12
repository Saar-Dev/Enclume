import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './234_pending_catastrophes.js'
import { assertTableExists, assertColumnsExist } from './testHelpers/schemaAssertions.mjs'

const PENDING_CATASTROPHES_COLUMNS = [
  'id', 'campaign_id', 'token_id', 'table_entry', 'applied_entry',
  'context', 'rolled_at', 'resolved_at', 'resolved_by',
]

// Tourne toujours, contrairement au test transactionnel ci-dessous (sauté dès que la migration a
// déjà tourné en dev) — détecte une dérive entre ce fichier et le schéma réel (SCHEMADRIFT-EXOTEMPLATES1,
// docs/JOURNAL8.md 2026-08-12).
test('schéma réel — pending_catastrophes porte toutes les colonnes de la migration 234', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertTableExists(db, 'pending_catastrophes')
  await assertColumnsExist(db, 'pending_catastrophes', PENDING_CATASTROPHES_COLUMNS)
})

test('migration 234 crée pending_catastrophes avec ses colonnes et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('pending_catastrophes')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    assert.equal(await trx.schema.hasTable('pending_catastrophes'), true)
    for (const column of PENDING_CATASTROPHES_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('pending_catastrophes', column), true, `colonne manquante: ${column}`)
    }

    await down(trx)
    assert.equal(await trx.schema.hasTable('pending_catastrophes'), false)
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
