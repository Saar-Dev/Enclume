export const up = async (knex) => {
  await knex.schema.createTable('walls', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('battlemap_id').notNullable().references('id').inTable('battlemaps').onDelete('CASCADE')
    table.float('x1').notNullable()
    table.float('y1').notNullable()
    table.float('x2').notNullable()
    table.float('y2').notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('zones', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('battlemap_id').notNullable().references('id').inTable('battlemaps').onDelete('CASCADE')
    table.text('level').notNullable() // 'advantage' | 'neutral' | 'disadvantage'
    table.jsonb('points').notNullable() // tableau de coordonnées du polygone
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('player_locations', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('battlemap_id').references('id').inTable('battlemaps').onDelete('SET NULL') // nullable — NULL = pas encore assigné
    table.timestamp('updated_at').defaultTo(knex.fn.now())
    table.unique(['campaign_id', 'user_id'])
  })
}

export const down = async (knex) => {
  await knex.schema.dropTable('player_locations')
  await knex.schema.dropTable('zones')
  await knex.schema.dropTable('walls')
}
