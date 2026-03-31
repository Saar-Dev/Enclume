export const up = (knex) => {
  return knex.schema.alterTable('tokens', (table) => {
    table.text('layer').notNullable().defaultTo('token')
    table.integer('cover_percent').notNullable().defaultTo(0)
    table.text('notes')
    table.text('gm_notes')
  })
}

export const down = (knex) => {
  return knex.schema.alterTable('tokens', (table) => {
    table.dropColumn('layer')
    table.dropColumn('cover_percent')
    table.dropColumn('notes')
    table.dropColumn('gm_notes')
  })
}
