export const up = (knex) => {
  return knex.schema.alterTable('battlemaps', (table) => {
    table.text('folder')
    table.text('scale_label').notNullable().defaultTo('1,5m')
    table.float('grid_opacity').notNullable().defaultTo(0.5)
  })
}

export const down = (knex) => {
  return knex.schema.alterTable('battlemaps', (table) => {
    table.dropColumn('folder')
    table.dropColumn('scale_label')
    table.dropColumn('grid_opacity')
  })
}
