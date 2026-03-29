export const up = (knex) => {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.text('email').unique().notNullable()
    table.text('password_hash').notNullable()
    table.text('username').notNullable()
    table.timestamps(true, true)
  })
}

export const down = (knex) => {
  return knex.schema.dropTable('users')
}