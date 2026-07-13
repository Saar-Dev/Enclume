export const up = async (knex) => {
  const hasBuiltinKey = await knex.schema.hasColumn('entity_blueprints', 'builtin_key')
  const hasCategory = await knex.schema.hasColumn('entity_blueprints', 'category')

  await knex.schema.alterTable('entity_blueprints', (table) => {
    table.uuid('created_by').nullable().alter()
    if (!hasBuiltinKey) table.text('builtin_key').nullable().unique()
    if (!hasCategory) table.text('category').nullable()
  })
}

export const down = async (knex) => {
  const hasBuiltinKey = await knex.schema.hasColumn('entity_blueprints', 'builtin_key')
  const hasCategory = await knex.schema.hasColumn('entity_blueprints', 'category')

  await knex.schema.alterTable('entity_blueprints', (table) => {
    if (hasCategory) table.dropColumn('category')
    if (hasBuiltinKey) table.dropColumn('builtin_key')
    table.uuid('created_by').notNullable().alter()
  })
}
