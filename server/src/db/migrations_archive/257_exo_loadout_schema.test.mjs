import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './257_exo_loadout_schema.js'
import { assertTableExists, assertColumnsExist, assertConstraintExists } from './testHelpers/schemaAssertions.mjs'

const INSTANCE_TABLES = ['exo_systems', 'exo_weapons', 'exo_programs', 'exo_computers']
const TEMPLATE_TABLES = ['ref_exo_template_equipment', 'ref_exo_template_computers']

const EXO_SYSTEMS_COLUMNS = ['id', 'character_id', 'equipment_id', 'label_override', 'level', 'integrite_max', 'integrite_current', 'sort_order']
const EXO_WEAPONS_COLUMNS = ['id', 'character_id', 'equipment_id', 'label_override', 'integrite_max', 'integrite_current', 'sort_order']
const EXO_PROGRAMS_COLUMNS = ['id', 'character_id', 'equipment_id', 'label_override', 'category', 'level', 'sort_order']
const EXO_COMPUTERS_COLUMNS = ['id', 'character_id', 'role', 'gen', 'nt', 'blindage_iem', 'integrite_max', 'integrite_current', 'sort_order']
const REF_TEMPLATE_EQUIPMENT_COLUMNS = ['id', 'template_id', 'family', 'equipment_id', 'label_override', 'level', 'sort_order']
const REF_TEMPLATE_COMPUTERS_COLUMNS = ['id', 'template_id', 'role', 'gen', 'nt', 'sort_order']

const EXO_SHEET_DROPPED_COLUMNS = ['equipped_systems', 'hardpoints', 'isolated_systems', 'damaged_systems']

const CHECK_CONSTRAINTS = [
  ['exo_systems', 'chk_exo_systems_source'],
  ['exo_weapons', 'chk_exo_weapons_source'],
  ['exo_programs', 'chk_exo_programs_source'],
  ['exo_computers', 'chk_exo_computers_role'],
  ['ref_exo_template_equipment', 'chk_exo_template_equipment_source'],
  ['ref_exo_template_equipment', 'chk_exo_template_equipment_family'],
  ['ref_exo_template_computers', 'chk_exo_template_computers_role'],
]

// Fixture minimale — mêmes patrons que 233_exo_sheet.test.mjs/254_exo_sheet_base_stats.test.mjs
// (users → campaigns → characters), étendue d'un ref_exo_templates puisque ce fichier teste aussi
// les tables catalogue (template_id-keyed), pas seulement l'instance.
async function createFixture(trx) {
  const [user] = await trx('users')
    .insert({ email: `mig257-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'mig257-gm' })
    .returning('*')
  const [campaign] = await trx('campaigns')
    .insert({ gm_id: user.id, name: 'Campagne test migration 257', invite_code: `MIG257-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await trx('characters')
    .insert({ campaign_id: campaign.id, user_id: user.id, name: 'Exo test migration 257', type: 'exo' })
    .returning('*')
  const [template] = await trx('ref_exo_templates')
    .insert({ name: 'Modèle test migration 257', category: 'exo-2', environment: 'hybrid' })
    .returning('*')
  return { user, campaign, character, template }
}

// Tourne toujours (patron SCHEMADRIFT-EXOTEMPLATES1, testHelpers/schemaAssertions.mjs) — c'est ce
// test qui détecterait une dérive entre ce fichier et le schéma réellement déployé.
test('schéma réel — les 6 tables du Lot C portent leurs colonnes/contraintes, exo_sheet a perdu les 4 jsonb', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  for (const table of [...INSTANCE_TABLES, ...TEMPLATE_TABLES]) {
    await assertTableExists(db, table)
  }
  await assertColumnsExist(db, 'exo_systems', EXO_SYSTEMS_COLUMNS)
  await assertColumnsExist(db, 'exo_weapons', EXO_WEAPONS_COLUMNS)
  await assertColumnsExist(db, 'exo_programs', EXO_PROGRAMS_COLUMNS)
  await assertColumnsExist(db, 'exo_computers', EXO_COMPUTERS_COLUMNS)
  await assertColumnsExist(db, 'ref_exo_template_equipment', REF_TEMPLATE_EQUIPMENT_COLUMNS)
  await assertColumnsExist(db, 'ref_exo_template_computers', REF_TEMPLATE_COMPUTERS_COLUMNS)
  for (const [table, constraint] of CHECK_CONSTRAINTS) {
    await assertConstraintExists(db, table, constraint)
  }
  for (const col of EXO_SHEET_DROPPED_COLUMNS) {
    assert.equal(await db.schema.hasColumn('exo_sheet', col), false, `exo_sheet.${col} devrait avoir été retirée par la migration 257`)
  }
})

test('migration 257 crée les 6 tables + retire les 4 jsonb exo_sheet, cascades correctes, revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('exo_systems')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)

    for (const table of [...INSTANCE_TABLES, ...TEMPLATE_TABLES]) {
      assert.equal(await trx.schema.hasTable(table), true, `table ${table} absente`)
    }
    for (const col of EXO_SHEET_DROPPED_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('exo_sheet', col), false, `exo_sheet.${col} toujours présente`)
    }

    const { character, template } = await createFixture(trx)

    // Instance — une ligne par table, custom (label_override, sans equipment_id) pour ne dépendre
    // d'aucun seed ref_exo_equipment/ref_equipment.
    const [system] = await trx('exo_systems')
      .insert({ character_id: character.id, label_override: 'Système custom 257', integrite_max: 10, integrite_current: 10 })
      .returning('*')
    const [weapon] = await trx('exo_weapons')
      .insert({ character_id: character.id, label_override: 'Arme custom 257', integrite_max: 8, integrite_current: 8 })
      .returning('*')
    const [program] = await trx('exo_programs')
      .insert({ character_id: character.id, label_override: 'Programme custom 257', category: 'specialise', level: 5 })
      .returning('*')
    const [computerPrincipal] = await trx('exo_computers')
      .insert({ character_id: character.id, role: 'principal', gen: 5, nt: 3 })
      .returning('*')
    const [computerSecours] = await trx('exo_computers')
      .insert({ character_id: character.id, role: 'secours', gen: 2, nt: 2 })
      .returning('*')
    assert.equal(system.character_id, character.id)
    assert.equal(weapon.character_id, character.id)
    assert.equal(program.character_id, character.id)
    // Deux ordinateurs sur le même personnage (principal + secours) — c'est exactement le cas RAW
    // (Nymph 1-A etc., PLAN_EXOARMURE.md §13.4.1) qu'une colonne scalaire aurait rendu impossible.
    assert.equal(computerPrincipal.character_id, character.id)
    assert.equal(computerSecours.character_id, character.id)

    // Catalogue — même exercice, template-keyed.
    const [templateEquipment] = await trx('ref_exo_template_equipment')
      .insert({ template_id: template.id, family: 'systeme', label_override: 'Système catalogue 257' })
      .returning('*')
    const [templateComputer] = await trx('ref_exo_template_computers')
      .insert({ template_id: template.id, role: 'principal', gen: 4, nt: 2 })
      .returning('*')
    assert.equal(templateEquipment.template_id, template.id)
    assert.equal(templateComputer.template_id, template.id)

    // Cascade character_id : supprimer le personnage vide les 4 tables instance.
    await trx('characters').where({ id: character.id }).delete()
    assert.equal(await trx('exo_systems').where({ id: system.id }).first(), undefined)
    assert.equal(await trx('exo_weapons').where({ id: weapon.id }).first(), undefined)
    assert.equal(await trx('exo_programs').where({ id: program.id }).first(), undefined)
    assert.equal(await trx('exo_computers').where({ character_id: character.id }).first(), undefined)

    // Cascade template_id : supprimer le template vide les 2 tables catalogue (contrairement à
    // exo_sheet.template_id qui reste SET NULL — une ligne de loadout catalogue n'a aucun sens sans
    // son template, PLAN_EXOARMURE.md §13.4.3).
    await trx('ref_exo_templates').where({ id: template.id }).delete()
    assert.equal(await trx('ref_exo_template_equipment').where({ id: templateEquipment.id }).first(), undefined)
    assert.equal(await trx('ref_exo_template_computers').where({ id: templateComputer.id }).first(), undefined)

    await down(trx)
    for (const table of [...INSTANCE_TABLES, ...TEMPLATE_TABLES]) {
      assert.equal(await trx.schema.hasTable(table), false, `table ${table} toujours présente après down`)
    }
    for (const col of EXO_SHEET_DROPPED_COLUMNS) {
      assert.equal(await trx.schema.hasColumn('exo_sheet', col), true, `exo_sheet.${col} non restaurée par down`)
    }

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

// Une violation de contrainte CHECK avorte la transaction Postgres en cours — testée séparément par
// contrainte (même caution que 254_exo_sheet_base_stats.test.mjs).
const sourceExclusivityChecks = [
  { table: 'exo_systems', constraint: 'chk_exo_systems_source', extra: {} },
  { table: 'exo_weapons', constraint: 'chk_exo_weapons_source', extra: {} },
  { table: 'exo_programs', constraint: 'chk_exo_programs_source', extra: { category: 'specialise', level: 1 } },
  { table: 'ref_exo_template_equipment', constraint: 'chk_exo_template_equipment_source', extra: { family: 'systeme' }, templateKeyed: true },
]

for (const { table, constraint, extra, templateKeyed } of sourceExclusivityChecks) {
  test(`${table} — la contrainte ${constraint} refuse equipment_id NULL ET label_override NULL`, {
    skip: !process.env.DATABASE_URL,
  }, async () => {
    const alreadyApplied = await db.schema.hasTable(table)
    if (alreadyApplied) return

    await assert.rejects(db.transaction(async (trx) => {
      await up(trx)
      const { character, template } = await createFixture(trx)
      const keyColumn = templateKeyed ? 'template_id' : 'character_id'
      const keyValue = templateKeyed ? template.id : character.id

      await assert.rejects(
        trx(table).insert({ [keyColumn]: keyValue, ...extra }),
        new RegExp(constraint),
        `la contrainte ${constraint} doit refuser equipment_id et label_override tous deux absents`,
      )

      // label_override seul doit passer — confirme que la contrainte teste bien une exclusivité
      // (OR), pas une obligation des deux champs à la fois.
      await trx(table).insert({ [keyColumn]: keyValue, label_override: 'ok', ...extra })

      throw new Error('ROLLBACK_MIGRATION_TEST')
    }), /ROLLBACK_MIGRATION_TEST/)
  })
}

const roleChecks = [
  { table: 'exo_computers', constraint: 'chk_exo_computers_role', keyColumn: 'character_id', extra: { gen: 1, nt: 1 } },
  { table: 'ref_exo_template_computers', constraint: 'chk_exo_template_computers_role', keyColumn: 'template_id', extra: { gen: 1, nt: 1 }, templateKeyed: true },
]

for (const { table, constraint, keyColumn, extra, templateKeyed } of roleChecks) {
  test(`${table} — la contrainte ${constraint} refuse un role hors principal/secours`, {
    skip: !process.env.DATABASE_URL,
  }, async () => {
    const alreadyApplied = await db.schema.hasTable(table)
    if (alreadyApplied) return

    await assert.rejects(db.transaction(async (trx) => {
      await up(trx)
      const { character, template } = await createFixture(trx)
      const keyValue = templateKeyed ? template.id : character.id

      await assert.rejects(
        trx(table).insert({ [keyColumn]: keyValue, role: 'tertiaire', ...extra }),
        new RegExp(constraint),
      )
      await trx(table).insert({ [keyColumn]: keyValue, role: 'secours', ...extra })

      throw new Error('ROLLBACK_MIGRATION_TEST')
    }), /ROLLBACK_MIGRATION_TEST/)
  })
}

test('ref_exo_template_equipment — la contrainte chk_exo_template_equipment_family refuse une famille hors arme/systeme', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('ref_exo_template_equipment')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    const { template } = await createFixture(trx)

    await assert.rejects(
      trx('ref_exo_template_equipment').insert({ template_id: template.id, family: 'armure', label_override: 'x' }),
      /chk_exo_template_equipment_family/,
    )
    await trx('ref_exo_template_equipment').insert({ template_id: template.id, family: 'arme', label_override: 'x' })

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
