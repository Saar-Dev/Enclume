import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './255_exo_sheet_notes.js'
import { assertColumnsExist } from './testHelpers/schemaAssertions.mjs'

test('schéma réel — exo_sheet porte la colonne notes de la migration 255', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertColumnsExist(db, 'exo_sheet', ['notes'])
})

test('migration 255 ajoute exo_sheet.notes (nullable, sans défaut) et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('exo_sheet', 'notes')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    assert.equal(await trx.schema.hasColumn('exo_sheet', 'notes'), true)

    const { rows } = await trx.raw(
      `SELECT column_default, is_nullable FROM information_schema.columns
       WHERE table_name = 'exo_sheet' AND column_name = 'notes'`
    )
    assert.equal(rows[0].column_default, null)
    assert.equal(rows[0].is_nullable, 'YES')

    await down(trx)
    assert.equal(await trx.schema.hasColumn('exo_sheet', 'notes'), false)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
