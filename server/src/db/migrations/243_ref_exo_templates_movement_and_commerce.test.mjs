import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './243_ref_exo_templates_movement_and_commerce.js'
import { assertColumnsExist, assertConstraintExists } from './testHelpers/schemaAssertions.mjs'

const REF_EXO_TEMPLATES_MOVEMENT_COMMERCE_COLUMNS = [
  'underwater_movement_mode', 'surface_movement_mode', 'speeds_extra',
  'manufacturer', 'price', 'rarity', 'tech_level', 'autonomy',
]

// Tourne toujours, contrairement aux tests transactionnels ci-dessous (sautés dès que la migration a
// déjà tourné en dev) — patron introduit par SCHEMADRIFT-EXOTEMPLATES1 (docs/JOURNAL8.md 2026-08-12)
// pour toute nouvelle migration désormais.
test('schéma réel — ref_exo_templates porte les colonnes/contraintes de la migration 243', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertColumnsExist(db, 'ref_exo_templates', REF_EXO_TEMPLATES_MOVEMENT_COMMERCE_COLUMNS)
  await assertConstraintExists(db, 'ref_exo_templates', 'chk_exo_template_underwater_mode')
  await assertConstraintExists(db, 'ref_exo_templates', 'chk_exo_template_surface_mode')
})

test('migration 243 ajoute les colonnes mode de déplacement/commerce sur ref_exo_templates et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('ref_exo_templates', 'underwater_movement_mode')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)

    for (const col of REF_EXO_TEMPLATES_MOVEMENT_COMMERCE_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('ref_exo_templates', col), true, `colonne ${col} absente`)
    }

    const [row] = await trx('ref_exo_templates')
      .insert({ name: '243-test', category: 'exo-1', environment: 'hybrid' })
      .returning('*')
    assert.equal(row.underwater_movement_mode, 'vit', 'défaut attendu : vit')
    assert.equal(row.surface_movement_mode, 'vit', 'défaut attendu : vit')
    assert.deepEqual(row.speeds_extra, [], 'défaut attendu : []')

    await down(trx)
    for (const col of REF_EXO_TEMPLATES_MOVEMENT_COMMERCE_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('ref_exo_templates', col), false, `colonne ${col} toujours présente après down`)
    }

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

// Une violation de contrainte CHECK avorte la transaction Postgres en cours — testée séparément
// (même caution que 240_users_role.test.mjs).
const checks = [
  { column: 'underwater_movement_mode', constraint: 'chk_exo_template_underwater_mode' },
  { column: 'surface_movement_mode', constraint: 'chk_exo_template_surface_mode' },
]

for (const { column, constraint } of checks) {
  test(`la contrainte ${constraint} refuse une valeur hors vit/pilot/blocked`, {
    skip: !process.env.DATABASE_URL,
  }, async () => {
    const alreadyApplied = await db.schema.hasColumn('ref_exo_templates', 'underwater_movement_mode')
    if (alreadyApplied) return

    await assert.rejects(db.transaction(async (trx) => {
      await up(trx)

      await assert.rejects(
        trx('ref_exo_templates').insert({
          name: 'bad-mode', category: 'exo-1', environment: 'hybrid', [column]: 'fly',
        }),
        new RegExp(constraint),
        `la contrainte ${constraint} doit refuser une valeur hors énumération`,
      )

      throw new Error('ROLLBACK_MIGRATION_TEST')
    }), /ROLLBACK_MIGRATION_TEST/)
  })
}

test.after(async () => { await db.destroy() })
