export const up = (knex) => {
  return knex.schema.createTable('campaigns', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('gm_id').notNullable().references('id').inTable('users')
    table.text('name').notNullable()
    table.text('invite_code').unique().notNullable()
    table.text('status').defaultTo('active')
    table.timestamps(true, true)
  })
}

export const down = (knex) => {
  return knex.schema.dropTable('campaigns')
}