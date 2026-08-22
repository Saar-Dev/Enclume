export const up = async (knex) => {
  await knex.schema.alterTable('token_statuses', (t) => {
    t.integer('expires_at_turn').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('token_statuses', (t) => {
    t.dropColumn('expires_at_turn')
  })
}
