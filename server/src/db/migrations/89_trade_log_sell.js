// Migration 89 — Ajout du type 'player_sell' dans trade_log
// Permet de tracer les reventes PJ→GM dans le livre de compte.

export const up = async (knex) => {
  await knex.raw(`ALTER TABLE trade_log DROP CONSTRAINT IF EXISTS chk_trade_log_type`)
  await knex.raw(`
    ALTER TABLE trade_log
      ADD CONSTRAINT chk_trade_log_type
        CHECK (type IN ('merchant_buy', 'player_transfer', 'gm_grant', 'player_sell'))
  `)
}

export const down = async (knex) => {
  await knex.raw(`ALTER TABLE trade_log DROP CONSTRAINT IF EXISTS chk_trade_log_type`)
  await knex.raw(`
    ALTER TABLE trade_log
      ADD CONSTRAINT chk_trade_log_type
        CHECK (type IN ('merchant_buy', 'player_transfer', 'gm_grant'))
  `)
}
