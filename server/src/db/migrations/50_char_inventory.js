export const up = async (knex) => {
  await knex.schema.createTable('char_inventory', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('character_id').notNullable()
      .references('id').inTable('characters').onDelete('CASCADE')
    table.uuid('equipment_id').nullable()
      .references('id').inTable('ref_equipment').onDelete('SET NULL')
    table.string('container', 20).notNullable().defaultTo('Coffre')
    table.string('slot', 20).nullable()
    table.integer('quantity').notNullable().defaultTo(1)
    table.string('custom_name', 255).nullable()
    table.text('custom_desc').nullable()
    table.text('notes').nullable()
    table.jsonb('custom_props').nullable()
    table.timestamps(true, true)
  })

  await knex.raw(`
    ALTER TABLE char_inventory
      ADD CONSTRAINT chk_inventory_quantity CHECK (quantity > 0)
  `)

  await knex.raw('CREATE INDEX idx_char_inventory_character_id ON char_inventory(character_id)')
  await knex.raw('CREATE INDEX idx_char_inventory_equipment_id ON char_inventory(equipment_id) WHERE equipment_id IS NOT NULL')
  await knex.raw('CREATE INDEX idx_char_inventory_slot ON char_inventory(slot) WHERE slot IS NOT NULL')

  await knex.schema.table('char_sheet', (table) => {
    table.integer('sols').notNullable().defaultTo(0)
  })
}

export const down = async (knex) => {
  await knex.schema.dropTable('char_inventory')
  await knex.schema.table('char_sheet', (table) => {
    table.dropColumn('sols')
  })
}
