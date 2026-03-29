export const up = (knex) => {
  return knex.schema.createTable('tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('battlemap_id').notNullable().references('id').inTable('battlemaps').onDelete('CASCADE')
    table.uuid('owner_id').references('id').inTable('users')
    table.text('label')
    table.text('image_url')
    table.float('pos_x').notNullable().defaultTo(0)
    table.float('pos_y').notNullable().defaultTo(0)
    table.float('width').notNullable().defaultTo(50)
    table.float('height').notNullable().defaultTo(50)
    table.integer('z_index').defaultTo(0)
    table.boolean('visible_to_players').defaultTo(true)
  })
}

export const down = (knex) => {
  return knex.schema.dropTable('tokens')
}