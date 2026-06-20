export const up = async (knex) => {
  await knex.schema.alterTable('combat_state', (table) => {
    table.text('sub_phase').nullable()
  })
  await knex.raw(`
    ALTER TABLE combat_state ADD CONSTRAINT chk_combat_sub_phase
      CHECK (sub_phase IN ('SLOT_ACTIVE','AWAITING_DEFENSE','AWAITING_DAMAGE'))
  `)
}

export const down = async (knex) => {
  await knex.schema.alterTable('combat_state', (table) => {
    table.dropColumn('sub_phase')
  })
}
