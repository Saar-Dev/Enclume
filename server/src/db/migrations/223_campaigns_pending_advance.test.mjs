import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './223_campaigns_pending_advance.js'
import { assertColumnsExist } from './testHelpers/schemaAssertions.mjs'

const CAMPAIGNS_PENDING_ADVANCE_COLUMNS = ['pending_advance_delta_minutes', 'pending_advance_undo_log']

// Tourne toujours, contrairement au test transactionnel ci-dessous (sauté dès que la migration a
// déjà tourné en dev) — détecte une dérive entre ce fichier et le schéma réel (SCHEMADRIFT-EXOTEMPLATES1,
// docs/JOURNAL8.md 2026-08-12).
test('schéma réel — campaigns porte les colonnes pending_advance_* de la migration 223', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertColumnsExist(db, 'campaigns', CAMPAIGNS_PENDING_ADVANCE_COLUMNS)
})

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
