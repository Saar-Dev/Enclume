export const up = (knex) => {
  return knex.schema.createTable('campaign_members', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users')
    table.text('role').notNullable()
    table.text('character_name')
    table.jsonb('sheet_data')
    table.timestamps(true, true)
    table.unique(['campaign_id', 'user_id'])
  })
}

export const down = (knex) => {
  return knex.schema.dropTable('campaign_members')
}