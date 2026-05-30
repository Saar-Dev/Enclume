export const up = async (knex) => {
  await knex.schema.alterTable('char_inventory', (table) => {
    table.integer('ammo_remaining').nullable()
  })
  await knex.schema.alterTable('campaigns', (table) => {
    table.boolean('pnj_unlimited_ammo').notNullable().defaultTo(true)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_inventory', (table) => {
    table.dropColumn('ammo_remaining')
  })
  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('pnj_unlimited_ammo')
  })
}