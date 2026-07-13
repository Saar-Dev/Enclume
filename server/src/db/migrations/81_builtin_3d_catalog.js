export const up = async (knex) => {
  await knex.schema.alterTable('entity_blueprints', (table) => {
    table.uuid('created_by').nullable().alter()
    table.text('builtin_key').nullable().unique()
    table.text('category').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('entity_blueprints', (table) => {
    table.dropColumn('category')
    table.dropColumn('builtin_key')
    table.uuid('created_by').notNullable().alter()
  })
}

