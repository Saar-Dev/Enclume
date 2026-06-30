// 99_char_advantages_v2.js
// Table char_advantages V2 avec soft-delete + snapshot_data + partial unique index.
// Source : docs/Character/Creation/PLAN_CREATION_E5.md Â§1 â€” converti ESM â†’ CJS.
//
// Note : migration 94 a dÃ©jÃ  droppÃ© l'ancienne table char_advantages.
// Le dropTableIfExists ici est un garde-fou idempotent.

export const up = async (knex) => {
  await knex.schema.dropTableIfExists('char_advantages')

  await knex.schema.createTable('char_advantages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('advantage_id').notNullable()
      .references('advantage_id').inTable('ref_advantages')

    // Snapshot intÃ©gral de ref_advantages au moment de l'ajout
    table.jsonb('snapshot_data').notNullable()

    // TraÃ§abilitÃ©
    table.timestamp('acquired_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.text('acquired_during').notNullable()  // 'creation_step5' | 'campaign' | 'trauma' | 'adjustment'
    table.timestamp('removed_at', { useTz: true })
    table.text('removal_reason')

    // Contrainte partielle : un seul avantage actif par personnage et advantage_id
    // ConfirmÃ© valide Knex v2.4.0+ (project : v3.2.7) â€” crÃ©e un index partiel PG
    table.unique(['char_sheet_id', 'advantage_id'], {
      predicate: knex.whereRaw('removed_at IS NULL')
    })
  })

  await knex.schema.alterTable('char_pc_ledger', (table) => {
    table.integer('pc_postcreation').defaultTo(0)
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('char_advantages')
  await knex.schema.alterTable('char_pc_ledger', (table) => {
    table.dropColumn('pc_postcreation')
  })
}
