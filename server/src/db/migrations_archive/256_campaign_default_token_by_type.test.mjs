import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './256_campaign_default_token_by_type.js'
import { assertColumnsExist } from './testHelpers/schemaAssertions.mjs'

const COLUMNS = ['default_token_glb_url_drone', 'default_token_glb_url_exo']

test('schéma réel — campaigns porte les colonnes de la migration 256', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertColumnsExist(db, 'campaigns', COLUMNS)
})

test('migration 256 ajoute default_token_glb_url_drone/_exo (nullables, sans défaut) et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('campaigns', 'default_token_glb_url_drone')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)

    for (const col of COLUMNS) {
      assert.equal(await trx.schema.hasColumn('campaigns', col), true, `colonne ${col} absente`)
    }

    const { rows } = await trx.raw(
      `SELECT column_name, column_default, is_nullable FROM information_schema.columns
       WHERE table_name = 'campaigns' AND column_name = ANY(?)`,
      [COLUMNS],
    )
    for (const row of rows) {
      assert.equal(row.column_default, null, `${row.column_name} ne doit avoir aucun défaut`)
      assert.equal(row.is_nullable, 'YES', `${row.column_name} doit être nullable`)
    }

    await down(trx)
    for (const col of COLUMNS) {
      assert.equal(await trx.schema.hasColumn('campaigns', col), false, `colonne ${col} toujours présente après down`)
    }

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
