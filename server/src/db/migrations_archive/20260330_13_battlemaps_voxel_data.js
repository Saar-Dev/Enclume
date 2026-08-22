export const up = (knex) => {
  return knex.schema.alterTable('battlemaps', (table) => {
    table.jsonb('voxel_data').defaultTo('[]')
  })
}

export const down = (knex) => {
  return knex.schema.alterTable('battlemaps', (table) => {
    table.dropColumn('voxel_data')
  })
}
