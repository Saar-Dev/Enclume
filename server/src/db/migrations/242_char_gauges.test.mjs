import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './242_char_gauges.js'

// Lancement manuel : node --env-file=../.env --test server/src/db/migrations/242_char_gauges.test.mjs
const skip = !process.env.DATABASE_URL

async function createFixture(trx) {
  const [gm] = await trx('users')
    .insert({ email: `242-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: '242-gm' })
    .returning('*')
  const [campaign] = await trx('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test 242', invite_code: `242-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await trx('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Perso test 242', type: 'pj' })
    .returning('*')
  const [charSheet] = await trx('char_sheet').insert({ character_id: character.id }).returning('*')
  return charSheet
}

test('migration 242 crée char_gauges + char_inventory.validated_by_gm, revient proprement', { skip }, async () => {
  const alreadyApplied = await db.schema.hasTable('char_gauges')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)

    assert.equal(await trx.schema.hasTable('char_gauges'), true)
    assert.equal(await trx.schema.hasColumn('char_inventory', 'validated_by_gm'), true)

    const charSheet = await createFixture(trx)

    const [gauge] = await trx('char_gauges')
      .insert({ char_sheet_id: charSheet.id, category_key: 'MATERIEL', value: 3 })
      .returning('*')
    assert.equal(gauge.value, 3)

    // Seed idempotent (PLAN_WIZARD_MATERIEL_GAUGES.md §2) : ON CONFLICT DO NOTHING ne doit jamais
    // écraser une ligne déjà présente.
    await trx('char_gauges')
      .insert({ char_sheet_id: charSheet.id, category_key: 'MATERIEL', value: 99 })
      .onConflict(['char_sheet_id', 'category_key']).ignore()
    const unchanged = await trx('char_gauges')
      .where({ char_sheet_id: charSheet.id, category_key: 'MATERIEL' }).first()
    assert.equal(unchanged.value, 3, 'onConflict DO NOTHING ne doit pas écraser la ligne existante')

    await down(trx)
    assert.equal(await trx.schema.hasTable('char_gauges'), false)
    assert.equal(await trx.schema.hasColumn('char_inventory', 'validated_by_gm'), false)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

// Test séparé : une violation de contrainte CHECK avorte la transaction Postgres en cours, donc pas
// d'assertion après elle dans la même transaction (même caution que 240_users_role.test.mjs).
test('la contrainte chk_gauges_value_non_negative refuse une valeur négative', { skip }, async () => {
  const alreadyApplied = await db.schema.hasTable('char_gauges')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    const charSheet = await createFixture(trx)

    await assert.rejects(
      trx('char_gauges').insert({ char_sheet_id: charSheet.id, category_key: 'MATERIEL', value: -1 }),
      /chk_gauges_value_non_negative/,
      'la contrainte CHECK doit refuser une valeur négative'
    )

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
