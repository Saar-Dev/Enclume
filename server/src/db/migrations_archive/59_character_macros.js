export const up = async (knex) => {
  await knex.schema.createTable('character_macros', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('character_id').notNullable()
      .references('id').inTable('characters').onDelete('CASCADE')
    table.text('label').notNullable()
    table.jsonb('sources').notNullable().defaultTo('[]')
    // sources = [{ type: 'attribute'|'skill'|'secondary', ref_id: '...', ref_label: '...' }]
    table.integer('modifier').notNullable().defaultTo(0)
    table.text('template')
    table.smallint('sort_order').notNullable().defaultTo(0)
    table.timestamps(true, true)
  })

  await knex.raw(`
    ALTER TABLE character_macros
      ADD CONSTRAINT chk_macros_sources_length
        CHECK (jsonb_array_length(sources) <= 3),
      ADD CONSTRAINT chk_macros_modifier
        CHECK (modifier >= -99 AND modifier <= 99)
  `)

  await knex.raw(
    'CREATE INDEX idx_macros_character_id ON character_macros(character_id)'
  )
}

export const down = async (knex) => {
  await knex.schema.dropTable('character_macros')
}
