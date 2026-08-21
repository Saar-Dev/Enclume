import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './260_exo_equipment_dual_catalog.js'
import { assertColumnsExist, assertConstraintExists } from './testHelpers/schemaAssertions.mjs'

const ALTERED_TABLES = ['exo_systems', 'exo_weapons', 'ref_exo_template_equipment']
const CHECK_NAMES = {
  exo_systems: 'chk_exo_systems_source',
  exo_weapons: 'chk_exo_weapons_source',
  ref_exo_template_equipment: 'chk_exo_template_equipment_source',
}

async function createFixture(trx) {
  const [user] = await trx('users')
    .insert({ email: `mig260-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'mig260-gm' })
    .returning('*')
  const [campaign] = await trx('campaigns')
    .insert({ gm_id: user.id, name: 'Campagne test migration 260', invite_code: `MIG260-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await trx('characters')
    .insert({ campaign_id: campaign.id, user_id: user.id, name: 'Exo test migration 260', type: 'exo' })
    .returning('*')
  const [template] = await trx('ref_exo_templates')
    .insert({ name: 'Modèle test migration 260', category: 'exo-2', environment: 'hybrid' })
    .returning('*')
  const [exoEquipment] = await trx('ref_exo_equipment')
    .insert({ family: 'systeme', category: 'Systèmes de contrôle', name: 'Système test 260' })
    .returning('*')
  const [genEquipment] = await trx('ref_equipment')
    .insert({ family: 'Armes', category: 'Arme de contact', name: 'Dague test 260', tech_level: 1 })
    .returning('*')
  return { user, campaign, character, template, exoEquipment, genEquipment }
}

test('schéma réel — ref_equipment_id existe sur les 3 tables, la contrainte source garde son nom', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  for (const table of ALTERED_TABLES) {
    await assertColumnsExist(db, table, ['ref_equipment_id'])
    await assertConstraintExists(db, table, CHECK_NAMES[table])
  }
})

test('migration 260 ajoute ref_equipment_id + resserre la contrainte source, revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('exo_systems', 'ref_equipment_id')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    for (const table of ALTERED_TABLES) {
      assert.equal(await trx.schema.hasColumn(table, 'ref_equipment_id'), true, `${table}.ref_equipment_id absente`)
    }

    await down(trx)
    for (const table of ALTERED_TABLES) {
      assert.equal(await trx.schema.hasColumn(table, 'ref_equipment_id'), false, `${table}.ref_equipment_id toujours présente après down`)
    }

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

// Exclusive arc : jamais les 2 vraies sources catalogue à la fois (equipment_id ET ref_equipment_id),
// jamais zéro branche — la faille de la migration 257 (simple OR) est justement ce que ce Lot corrige.
// Révision migration 262 (PLAN_EXOARMURE.md §13.4.4 suite, trouvé en relecture critique avant la
// transcription) : `equipment_id + label_override` et `ref_equipment_id + label_override` ne sont
// PLUS des cas refusés (le label devient une annotation à côté d'une vraie source, ex. "SACEA
// (secours)") — retirés d'ici, couverts par `262_exo_equipment_source_check_fix.test.mjs` côté
// combinaisons désormais acceptées. Ce fichier ne garde que ce que 260 garantit encore réellement une
// fois 262 appliquée dans le même environnement, pas l'état transitoire d'entre les deux migrations.
const sources = [
  { table: 'exo_systems', keyColumn: 'character_id', extra: {} },
  { table: 'exo_weapons', keyColumn: 'character_id', extra: {} },
  { table: 'ref_exo_template_equipment', keyColumn: 'template_id', extra: { family: 'systeme' } },
]

// Une violation de CHECK avorte toute la transaction Postgres en cours (le statement suivant échoue
// avec "current transaction is aborted", pas avec une nouvelle vraie erreur de contrainte) — chaque
// cas refusé tourne donc dans sa propre transaction, jamais deux `assert.rejects` d'affilée dans la
// même transaction (même caution que 254_exo_sheet_base_stats.test.mjs/257).
const invalidCombos = [
  ['zéro branche', {}],
  ['equipment_id + ref_equipment_id', { useExo: true, useGen: true }],
]

for (const { table, keyColumn, extra } of sources) {
  const constraint = CHECK_NAMES[table]

  for (const [description, combo] of invalidCombos) {
    test(`${table} — exclusive arc refuse : ${description}`, {
      skip: !process.env.DATABASE_URL,
    }, async () => {
      const alreadyApplied = await db.schema.hasColumn(table, 'ref_equipment_id')

      await assert.rejects(db.transaction(async (trx) => {
        if (!alreadyApplied) await up(trx)
        const { character, template, exoEquipment, genEquipment } = await createFixture(trx)
        const keyValue = keyColumn === 'template_id' ? template.id : character.id

        await trx(table).insert({
          [keyColumn]: keyValue,
          ...(combo.useExo ? { equipment_id: exoEquipment.id } : {}),
          ...(combo.useGen ? { ref_equipment_id: genEquipment.id } : {}),
          ...(combo.useLabel ? { label_override: 'x' } : {}),
          ...extra,
        })
      }), new RegExp(constraint))
    })
  }

  test(`${table} — exclusive arc accepte chacune des 3 branches seule`, {
    skip: !process.env.DATABASE_URL,
  }, async () => {
    const alreadyApplied = await db.schema.hasColumn(table, 'ref_equipment_id')

    await assert.rejects(db.transaction(async (trx) => {
      if (!alreadyApplied) await up(trx)
      const { character, template, exoEquipment, genEquipment } = await createFixture(trx)
      const keyValue = keyColumn === 'template_id' ? template.id : character.id

      await trx(table).insert({ [keyColumn]: keyValue, equipment_id: exoEquipment.id, ...extra })
      await trx(table).insert({ [keyColumn]: keyValue, ref_equipment_id: genEquipment.id, ...extra })
      await trx(table).insert({ [keyColumn]: keyValue, label_override: 'x', ...extra })

      throw new Error('ROLLBACK_MIGRATION_TEST')
    }), /ROLLBACK_MIGRATION_TEST/)
  })
}

test.after(async () => { await db.destroy() })
