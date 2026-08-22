export const up = async (knex) => {
  await knex.schema.dropTableIfExists('char_creation_snapshot')
}

export const down = async (knex) => {
  await knex.schema.createTable('char_creation_snapshot', table => {
    table.increments('id')
    table.integer('char_sheet_id').notNullable().references('id').inTable('char_sheet').onDelete('CASCADE')
    table.string('step').notNullable()
    table.jsonb('snapshot').notNullable()
    table.unique(['char_sheet_id', 'step'])
  })
}
