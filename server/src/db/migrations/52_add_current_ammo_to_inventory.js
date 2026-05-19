export const up = async (knex) => {
  await knex.schema.alterTable('char_inventory', (table) => {
    table.uuid('current_ammo').nullable()
      .references('id').inTable('ref_equipment').onDelete('SET NULL')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_inventory', (table) => {
    table.dropColumn('current_ammo')
  })
}
