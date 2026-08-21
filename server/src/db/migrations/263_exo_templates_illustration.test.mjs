import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './263_exo_templates_illustration.js'
import { assertColumnsExist } from './testHelpers/schemaAssertions.mjs'

test('schéma réel — ref_exo_templates.illustration_url existe', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertColumnsExist(db, 'ref_exo_templates', ['illustration_url'])
})

test('migration 263 ajoute illustration_url et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('ref_exo_templates', 'illustration_url')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    assert.equal(await trx.schema.hasColumn('ref_exo_templates', 'illustration_url'), true)

    await down(trx)
    assert.equal(await trx.schema.hasColumn('ref_exo_templates', 'illustration_url'), false)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
