import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './233_exo_sheet.js'
import { assertTableExists, assertColumnsExist, assertConstraintExists } from './testHelpers/schemaAssertions.mjs'

// Colonnes réellement créées par le up() de CETTE migration — inchangé, une migration déjà appliquée
// ne se retouche jamais (CLAUDE.md §5). Utilisé par le test transactionnel ci-dessous, qui rejoue
// up()/down() de 233 en isolation : à cet instant précis du replay, les 4 colonnes jsonb existent
// bel et bien (elles ne sont retirées que par la migration 257, plus tard dans la chaîne).
const EXO_SHEET_COLUMNS_AT_233 = [
  'character_id', 'template_id', 'pilot_character_id',
  'itg_structure_max', 'itg_structure_current',
  'itg_exosquelette_max', 'itg_exosquelette_current',
  'itg_generator_max', 'itg_generator_current',
  'avaries_legeres', 'avaries_moyennes', 'avaries_graves',
  'avaries_critiques', 'avaries_catastrophiques',
  'equipped_systems', 'hardpoints', 'isolated_systems', 'damaged_systems',
]
// Colonnes de 233 encore présentes dans le schéma réellement déployé aujourd'hui — utilisé par le
// test "schéma réel" (toujours actif, SCHEMADRIFT-EXOTEMPLATES1) qui vérifie l'état ACTUEL de la
// base, pas un instantané figé. Les 4 colonnes jsonb ont été retirées par la migration 257
// (PLAN_EXOARMURE.md §13.4, 2026-08-21, jamais peuplées par aucun code de production) — les garder
// ici ferait échouer ce test en permanence pour une dérive qui n'en est pas une.
const EXO_SHEET_COLUMNS_TODAY = EXO_SHEET_COLUMNS_AT_233.filter(
  col => !['equipped_systems', 'hardpoints', 'isolated_systems', 'damaged_systems'].includes(col)
)
const REF_EXO_TEMPLATES_COLUMNS = ['base_speed_underwater', 'base_speed_surface']

// Tourne toujours (contrairement au test transactionnel ci-dessous, sauté dès que la migration a
// déjà tourné en dev) — c'est ce test qui aurait détecté SCHEMADRIFT-EXOTEMPLATES1 dès son
// apparition le 2026-08-06 plutôt que le 2026-08-12.
test('schéma réel — exo_sheet/ref_exo_templates portent toutes les colonnes/contraintes de la migration 233', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertTableExists(db, 'exo_sheet')
  await assertTableExists(db, 'ref_exo_templates')
  await assertColumnsExist(db, 'exo_sheet', EXO_SHEET_COLUMNS_TODAY)
  await assertColumnsExist(db, 'ref_exo_templates', REF_EXO_TEMPLATES_COLUMNS)
  await assertConstraintExists(db, 'ref_exo_templates', 'chk_exo_template_category')
  await assertConstraintExists(db, 'ref_exo_templates', 'chk_exo_template_environment')
})

test('migration 233 ajoute exo_sheet/ref_exo_templates et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('exo_sheet')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)

    assert.equal(await trx.schema.hasTable('ref_exo_templates'), true)
    assert.equal(await trx.schema.hasTable('exo_sheet'), true)
    for (const col of EXO_SHEET_COLUMNS_AT_233) {
      assert.equal(await trx.schema.hasColumn('exo_sheet', col), true, `colonne ${col} absente`)
    }
    for (const col of REF_EXO_TEMPLATES_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('ref_exo_templates', col), true, `colonne ${col} absente`)
    }

    // CHECK constraint refuse un type hors-liste
    await assert.rejects(
      trx('characters').insert({
        campaign_id: trx.raw('gen_random_uuid()'), name: 'test', type: 'vehicule',
      }),
      /chk_character_type/,
    )

    // Cascade character_id + template_id passe à NULL si le template référencé est supprimé
    const [user] = await trx('users')
      .insert({ email: `exo-233-${Date.now()}@test.local`, password_hash: 'x', username: 'exo-233-test' })
      .returning('id')
    const [campaign] = await trx('campaigns')
      .insert({ gm_id: user.id, name: 'test-233', invite_code: `EXO233-${Date.now()}` })
      .returning('id')
    const [character] = await trx('characters')
      .insert({ campaign_id: campaign.id, name: 'exo-test', type: 'exo' })
      .returning('id')
    const [template] = await trx('ref_exo_templates').insert({
      name: 'orka_mk1', category: 'exo-2', environment: 'hybrid',
    }).returning('id')
    await trx('exo_sheet').insert({ character_id: character.id, template_id: template.id })

    await trx('ref_exo_templates').where({ id: template.id }).delete()
    const sheetAfterTemplateDelete = await trx('exo_sheet').where({ character_id: character.id }).first()
    assert.equal(sheetAfterTemplateDelete.template_id, null)

    // Index unique partiel : un second pilot_character_id identique est rejeté, plusieurs NULL passent
    const [pilot] = await trx('characters')
      .insert({ campaign_id: campaign.id, name: 'pilote-test', type: 'pj' })
      .returning('id')
    const [character2] = await trx('characters')
      .insert({ campaign_id: campaign.id, name: 'exo-test-2', type: 'exo' })
      .returning('id')
    await trx('exo_sheet').insert({ character_id: character2.id })

    await trx('exo_sheet').where({ character_id: character.id }).update({ pilot_character_id: pilot.id })
    await assert.rejects(
      trx('exo_sheet').where({ character_id: character2.id }).update({ pilot_character_id: pilot.id }),
      /exo_sheet_pilot_unique/,
    )

    await trx('characters').where({ id: character.id }).delete()
    assert.equal(await trx('exo_sheet').where({ character_id: character.id }).first(), undefined)

    await down(trx)
    assert.equal(await trx.schema.hasTable('exo_sheet'), false)
    assert.equal(await trx.schema.hasTable('ref_exo_templates'), false)
    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
