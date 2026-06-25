// Migration 88 — Extension trade_offers pour la revente PJ→GM
// Ajoute : colonne type ('EXCHANGE' | 'SELL') + to_char_id nullable.
// EXCHANGE = échange PJ↔PJ (comportement existant).
// SELL    = proposition de revente PJ → GM (to_char_id = NULL).

export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE trade_offers
      ADD COLUMN type TEXT NOT NULL DEFAULT 'EXCHANGE'
  `)
  await knex.raw(`
    ALTER TABLE trade_offers
      ADD CONSTRAINT chk_trade_offer_type
        CHECK (type IN ('EXCHANGE', 'SELL'))
  `)
  await knex.raw(`
    ALTER TABLE trade_offers
      ALTER COLUMN to_char_id DROP NOT NULL
  `)
}

export const down = async (knex) => {
  await knex.raw(`ALTER TABLE trade_offers DROP CONSTRAINT IF EXISTS chk_trade_offer_type`)
  await knex.raw(`ALTER TABLE trade_offers DROP COLUMN IF EXISTS type`)
  await knex.raw(`ALTER TABLE trade_offers ALTER COLUMN to_char_id SET NOT NULL`)
}
