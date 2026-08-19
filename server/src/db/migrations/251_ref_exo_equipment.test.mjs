import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './251_ref_exo_equipment.js'
import { assertTableExists, assertColumnsExist, assertConstraintExists } from './testHelpers/schemaAssertions.mjs'

const REF_EXO_EQUIPMENT_COLUMNS = [
  'id', 'family', 'category', 'name', 'description',
  'price', 'price_modifier', 'tech_level', 'rarity', 'max_level', 'duration',
  'damage', 'shock', 'range', 'init_mod', 'fire_mode', 'ammo_cost',
]

test('schéma réel — ref_exo_equipment porte toutes les colonnes/contraintes de la migration 251', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertTableExists(db, 'ref_exo_equipment')
  await assertColumnsExist(db, 'ref_exo_equipment', REF_EXO_EQUIPMENT_COLUMNS)
  await assertConstraintExists(db, 'ref_exo_equipment', 'chk_exoeq_family')
  await assertConstraintExists(db, 'ref_exo_equipment', 'chk_exoeq_init_mod')
  await assertConstraintExists(db, 'ref_exo_equipment', 'chk_exoeq_fire_mode')
})

test('migration 251 ajoute ref_exo_equipment et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('ref_exo_equipment')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)

    assert.equal(await trx.schema.hasTable('ref_exo_equipment'), true)
    for (const col of REF_EXO_EQUIPMENT_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('ref_exo_equipment', col), true, `colonne ${col} absente`)
    }

    const [row] = await trx('ref_exo_equipment')
      .insert({ family: 'systeme', category: 'Systèmes de contrôle', name: '251-test' })
      .returning('*')
    assert.equal(row.family, 'systeme')

    await down(trx)
    assert.equal(await trx.schema.hasTable('ref_exo_equipment'), false)
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test('contrainte chk_exoeq_family refuse une valeur hors arme/systeme', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('ref_exo_equipment')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    await assert.rejects(
      trx('ref_exo_equipment').insert({ family: 'armure', category: 'x', name: 'bad-family' }),
      /chk_exoeq_family/,
    )
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test('contrainte chk_exoeq_init_mod refuse une valeur >= 0', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('ref_exo_equipment')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    await assert.rejects(
      trx('ref_exo_equipment').insert({ family: 'arme', category: 'x', name: 'bad-init', init_mod: 0 }),
      /chk_exoeq_init_mod/,
    )
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test('contrainte chk_exoeq_fire_mode refuse une valeur hors énumération', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('ref_exo_equipment')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    await assert.rejects(
      trx('ref_exo_equipment').insert({ family: 'arme', category: 'x', name: 'bad-fire-mode', fire_mode: 'AUTO' }),
      /chk_exoeq_fire_mode/,
    )
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
