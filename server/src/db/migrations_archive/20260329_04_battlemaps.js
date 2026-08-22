export const up = (knex) => {
  return knex.schema.createTable('battlemaps', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE')
    table.text('name').notNullable()
    table.text('image_url')
    table.integer('grid_size').defaultTo(50)
    table.boolean('grid_enabled').defaultTo(true)
    table.jsonb('viewport_state').defaultTo('{}')
    table.timestamps(true, true)
  })
}

export const down = (knex) => {
  return knex.schema.dropTable('battlemaps')
}