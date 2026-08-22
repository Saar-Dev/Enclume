// Migration 85 — Table trade_log
// Livre de compte des transactions (lecture seule GM).
// from_char_id nullable : NULL = marchand ou don GM.
// merchant_id nullable : NULL = échange PJ↔PJ ou don GM.

export const up = async (knex) => {
  await knex.schema.createTable('trade_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('campaign_id').notNullable()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    table.text('type').notNullable()
    table.uuid('from_char_id').nullable()
      .references('id').inTable('characters').onDelete('SET NULL')
    table.uuid('to_char_id').nullable()
      .references('id').inTable('characters').onDelete('SET NULL')
    table.uuid('merchant_id').nullable()
      .references('id').inTable('merchants').onDelete('SET NULL')
    table.integer('sols_delta').notNullable().defaultTo(0)
    table.jsonb('items_json').notNullable().defaultTo('[]')
    table.text('note').nullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.raw(`
    ALTER TABLE trade_log
      ADD CONSTRAINT chk_trade_log_type
        CHECK (type IN ('merchant_buy', 'player_transfer', 'gm_grant'))
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('trade_log')
}
