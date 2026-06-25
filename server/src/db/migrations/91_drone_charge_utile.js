// Migration 91 — drone_sheet.charge_utile + trade_log type constraint
// charge_utile : capacité de charge en kg (0 = illimité / non configuré)
// Étend chk_trade_log_type pour inclure 'drone_reload'

export const up = async (knex) => {
  await knex.schema.table('drone_sheet', (table) => {
    table.integer('charge_utile').notNullable().defaultTo(0)
  })
  await knex.raw(`ALTER TABLE trade_log DROP CONSTRAINT IF EXISTS chk_trade_log_type`)
  await knex.raw(`ALTER TABLE trade_log ADD CONSTRAINT chk_trade_log_type
    CHECK (type IN ('merchant_buy', 'player_transfer', 'gm_grant', 'player_sell', 'drone_reload'))`)
}

export const down = async (knex) => {
  await knex.schema.table('drone_sheet', (table) => {
    table.dropColumn('charge_utile')
  })
  await knex.raw(`ALTER TABLE trade_log DROP CONSTRAINT IF EXISTS chk_trade_log_type`)
  await knex.raw(`ALTER TABLE trade_log ADD CONSTRAINT chk_trade_log_type
    CHECK (type IN ('merchant_buy', 'player_transfer', 'gm_grant', 'player_sell'))`)
}
