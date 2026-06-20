export const up = async (knex) => {
  await knex.schema.createTable('combat_pending', (table) => {
    table.uuid('campaign_id').notNullable()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('token_id').notNullable()
      .references('id').inTable('tokens').onDelete('CASCADE')
    table.text('type').notNullable()
    table.jsonb('payload').notNullable().defaultTo('{}')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.primary(['campaign_id', 'token_id', 'type'])
  })
  await knex.raw(`
    ALTER TABLE combat_pending ADD CONSTRAINT chk_pending_type
      CHECK (type IN ('melee_defense', 'damage', 'stun'))
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('combat_pending')
}
