export const up = async (knex) => {
  await knex.schema.alterTable('characters', (table) => {
    table.text('type').notNullable().defaultTo('pnj')
  })
  await knex.raw(`
    ALTER TABLE characters
      ADD CONSTRAINT chk_character_type CHECK (type IN ('pj', 'pnj'))
  `)
  // Backfill : user_id non-null → PJ
  await knex('characters').whereNotNull('user_id').update({ type: 'pj' })
}

export const down = async (knex) => {
  await knex.schema.alterTable('characters', (table) => {
    table.dropColumn('type')
  })
}
