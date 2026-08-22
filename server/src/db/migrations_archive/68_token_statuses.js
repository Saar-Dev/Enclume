export const up = async (knex) => {
  await knex.schema.createTable('token_statuses', (t) => {
    t.increments('id')
    t.uuid('token_id').notNullable()
      .references('id').inTable('tokens').onDelete('CASCADE')
    t.text('status_code').notNullable()
    t.uuid('applied_by').nullable()
      .references('id').inTable('users').onDelete('SET NULL')
    t.timestamp('applied_at').notNullable().defaultTo(knex.fn.now())
    t.unique(['token_id', 'status_code'])
  })
}

export const down = async (knex) => {
  await knex.schema.dropTable('token_statuses')
}
