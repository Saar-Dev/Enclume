export const up = async (knex) => {
  await knex.schema.alterTable('ref_equipment', (table) => {
    table.integer('generation').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('ref_equipment', (table) => {
    table.dropColumn('generation')
  })
}
