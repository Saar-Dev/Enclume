export const up = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.text('cover_url').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('cover_url')
  })
}
