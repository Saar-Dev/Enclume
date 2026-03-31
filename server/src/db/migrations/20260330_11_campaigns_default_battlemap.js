export const up = (knex) => {
  return knex.schema.alterTable('campaigns', (table) => {
    table.uuid('default_battlemap_id').references('id').inTable('battlemaps').onDelete('SET NULL')
  })
}

export const down = (knex) => {
  return knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('default_battlemap_id')
  })
}
