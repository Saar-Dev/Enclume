// Migration 90 — Contre-offre + merchant_id dans trade_offers
// Ajoute le statut COUNTER_OFFERED, la colonne counter_sols (prix contre-offert par le GM)
// et merchant_id pour tracer quel marchand est impliqué dans la revente.

export const up = async (knex) => {
  await knex.raw(`ALTER TABLE trade_offers DROP CONSTRAINT IF EXISTS chk_trade_offer_status`)
  await knex.raw(`
    ALTER TABLE trade_offers
      ADD CONSTRAINT chk_trade_offer_status
        CHECK (status IN ('PENDING','COUNTER_OFFERED','ACCEPTED','DECLINED','CANCELLED'))
  `)
  await knex.raw(`ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS counter_sols INTEGER`)
  await knex.raw(`
    ALTER TABLE trade_offers
      ADD COLUMN IF NOT EXISTS merchant_id UUID
        REFERENCES merchants(id) ON DELETE SET NULL
  `)
}

export const down = async (knex) => {
  await knex.raw(`ALTER TABLE trade_offers DROP CONSTRAINT IF EXISTS chk_trade_offer_status`)
  await knex.raw(`
    ALTER TABLE trade_offers
      ADD CONSTRAINT chk_trade_offer_status
        CHECK (status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED'))
  `)
  await knex.raw(`ALTER TABLE trade_offers DROP COLUMN IF EXISTS counter_sols`)
  await knex.raw(`ALTER TABLE trade_offers DROP COLUMN IF EXISTS merchant_id`)
}
