import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './262_exo_equipment_source_check_fix.js'
import { assertConstraintExists } from './testHelpers/schemaAssertions.mjs'

const ALTERED_TABLES = ['exo_systems', 'exo_weapons', 'ref_exo_template_equipment']
const CHECK_NAMES = {
  exo_systems: 'chk_exo_systems_source',
  exo_weapons: 'chk_exo_weapons_source',
  ref_exo_template_equipment: 'chk_exo_template_equipment_source',
}

async function createFixture(trx) {
  const [user] = await trx('users')
    .insert({ email: `mig262-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'mig262-gm' })
    .returning('*')
  const [campaign] = await trx('campaigns')
    .insert({ gm_id: user.id, name: 'Campagne test migration 262', invite_code: `MIG262-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await trx('characters')
    .insert({ campaign_id: campaign.id, user_id: user.id, name: 'Exo test migration 262', type: 'exo' })
    .returning('*')
  const [template] = await trx('ref_exo_templates')
    .insert({ name: 'Modèle test migration 262', category: 'exo-2', environment: 'hybrid' })
    .returning('*')
  const [exoEquipment] = await trx('ref_exo_equipment')
    .insert({ family: 'systeme', category: 'Systèmes de contrôle', name: 'Système test 262' })
    .returning('*')
  const [genEquipment] = await trx('ref_equipment')
    .insert({ family: 'Armes', category: 'Arme de contact', name: 'Dague test 262', tech_level: 1 })
    .returning('*')
  return { character, template, exoEquipment, genEquipment }
}

test('schéma réel — la contrainte source garde son nom sur les 3 tables', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  for (const table of ALTERED_TABLES) {
    await assertConstraintExists(db, table, CHECK_NAMES[table])
  }
})

test('migration 262 resserre le CHECK (jamais 2 sources, au moins 1 renseignée) et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const constraint = await db.raw(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'chk_exo_systems_source'`)
  const alreadyApplied = constraint.rows[0]?.def?.includes('NOT')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    const def = await trx.raw(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'chk_exo_systems_source'`)
    assert.match(def.rows[0].d, /NOT/)

    await down(trx)
    const defAfter = await trx.raw(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'chk_exo_systems_source'`)
    assert.doesNotMatch(defAfter.rows[0].d, /NOT/)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

const sources = [
  { table: 'exo_systems', keyColumn: 'character_id', extra: {} },
  { table: 'exo_weapons', keyColumn: 'character_id', extra: {} },
  { table: 'ref_exo_template_equipment', keyColumn: 'template_id', extra: { family: 'systeme' } },
]

// Une violation de CHECK avorte toute la transaction Postgres en cours — chaque cas refusé tourne
// dans sa propre transaction (même caution que 260, piège déjà rencontré en écrivant ces tests-là).
const invalidCombos = [
  ['zéro branche', {}],
  ['equipment_id + ref_equipment_id (les 2 vraies sources à la fois)', { useExo: true, useGen: true }],
]

const validCombos = [
  ['equipment_id seul', { useExo: true }],
  ['ref_equipment_id seul', { useGen: true }],
  ['label_override seul', { useLabel: true }],
  ['equipment_id + label_override (annotation — le correctif de ce Lot)', { useExo: true, useLabel: true }],
  ['ref_equipment_id + label_override (annotation — le correctif de ce Lot)', { useGen: true, useLabel: true }],
]

for (const { table, keyColumn, extra } of sources) {
  const constraint = CHECK_NAMES[table]

  for (const [description, combo] of invalidCombos) {
    test(`${table} — CHECK corrigé refuse toujours : ${description}`, {
      skip: !process.env.DATABASE_URL,
    }, async () => {
      const constraintDef = await db.raw(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = ?`, [constraint])
      const alreadyApplied = constraintDef.rows[0]?.d?.includes('NOT')

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

  test(`${table} — CHECK corrigé accepte les 5 combinaisons valides (dont l'annotation, le correctif de ce Lot)`, {
    skip: !process.env.DATABASE_URL,
  }, async () => {
    const constraintDef = await db.raw(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = ?`, [constraint])
    const alreadyApplied = constraintDef.rows[0]?.d?.includes('NOT')

    await assert.rejects(db.transaction(async (trx) => {
      if (!alreadyApplied) await up(trx)
      const { character, template, exoEquipment, genEquipment } = await createFixture(trx)
      const keyValue = keyColumn === 'template_id' ? template.id : character.id

      for (const [, combo] of validCombos) {
        await trx(table).insert({
          [keyColumn]: keyValue,
          ...(combo.useExo ? { equipment_id: exoEquipment.id } : {}),
          ...(combo.useGen ? { ref_equipment_id: genEquipment.id } : {}),
          ...(combo.useLabel ? { label_override: 'x' } : {}),
          ...extra,
        })
      }

      throw new Error('ROLLBACK_MIGRATION_TEST')
    }), /ROLLBACK_MIGRATION_TEST/)
  })
}

test.after(async () => { await db.destroy() })
