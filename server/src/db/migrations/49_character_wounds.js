export const up = async (knex) => {
  await knex.schema.createTable('character_wounds', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id').notNullable()
      .references('id').inTable('char_sheet').onDelete('CASCADE')
    table.text('location').notNullable()
    table.text('severity').notNullable()
    table.boolean('is_stabilized').notNullable().defaultTo(false)
    table.timestamps(true, true)
  })

  // CHECK constraints — raw SQL pour fiabilité maximale (pattern migration 48)
  await knex.raw(`
    ALTER TABLE character_wounds
      ADD CONSTRAINT chk_wounds_location
        CHECK (location IN ('tete','corps','bras_droit','bras_gauche','jambe_droite','jambe_gauche')),
      ADD CONSTRAINT chk_wounds_severity
        CHECK (severity IN ('legere','moyenne','grave','critique','mortelle'))
  `)

  await knex.raw(
    'CREATE INDEX idx_wounds_char_sheet_id ON character_wounds(char_sheet_id)'
  )
}

export const down = async (knex) => {
  await knex.schema.dropTable('character_wounds')
}
