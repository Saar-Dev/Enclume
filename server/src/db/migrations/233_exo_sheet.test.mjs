import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './233_exo_sheet.js'

test('migration 233 ajoute exo_sheet/ref_exo_templates et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasTable('exo_sheet')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)

    assert.equal(await trx.schema.hasTable('ref_exo_templates'), true)
    assert.equal(await trx.schema.hasTable('exo_sheet'), true)
    for (const col of [
      'character_id', 'template_id', 'pilot_character_id',
      'itg_structure_max', 'itg_structure_current',
      'itg_exosquelette_max', 'itg_exosquelette_current',
      'itg_generator_max', 'itg_generator_current',
      'avaries_legeres', 'avaries_moyennes', 'avaries_graves',
      'avaries_critiques', 'avaries_catastrophiques',
      'equipped_systems', 'hardpoints', 'isolated_systems', 'damaged_systems',
    ]) assert.equal(await trx.schema.hasColumn('exo_sheet', col), true, `colonne ${col} absente`)
    for (const col of [
      'base_speed_underwater', 'base_speed_surface',
      'underwater_movement_mode', 'surface_movement_mode', 'speeds_extra',
      'manufacturer', 'price', 'rarity', 'tech_level', 'autonomy',
    ]) assert.equal(await trx.schema.hasColumn('ref_exo_templates', col), true, `colonne ${col} absente`)

    // CHECK constraint refuse un type hors-liste
    await assert.rejects(
      trx('characters').insert({
        campaign_id: trx.raw('gen_random_uuid()'), name: 'test', type: 'vehicule',
      }),
      /chk_character_type/,
    )

    // CHECK constraint refuse un mode de mouvement hors-liste
    await assert.rejects(
      trx('ref_exo_templates').insert({
        name: 'bad-mode', category: 'exo-1', environment: 'hybrid', surface_movement_mode: 'fly',
      }),
      /chk_exo_template_surface_mode/,
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
