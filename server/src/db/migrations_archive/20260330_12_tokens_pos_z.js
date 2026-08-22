export const up = (knex) => {
  return knex.schema.alterTable('tokens', (table) => {
    table.float('pos_z').notNullable().defaultTo(0)
  })
}

export const down = (knex) => {
  return knex.schema.alterTable('tokens', (table) => {
    table.dropColumn('pos_z')
  })
}
