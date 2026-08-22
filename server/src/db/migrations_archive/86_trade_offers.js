// Migration 86 — Table trade_offers
// Offres d'échange PJ↔PJ en cours.
// Source de vérité persistante — survit aux redémarrages serveur.
// expires_at = NOW() + campaigns.tour_duration au moment de la création.
// Contrainte applicative : 1 offre PENDING max par from_char_id (non enforced en DB).

export const up = async (knex) => {
  await knex.schema.createTable('trade_offers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('campaign_id').notNullable()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('from_char_id').notNullable()
      .references('id').inTable('characters').onDelete('CASCADE')
    table.uuid('to_char_id').notNullable()
      .references('id').inTable('characters').onDelete('CASCADE')
    table.text('status').notNullable().defaultTo('PENDING')
    table.jsonb('items_json').notNullable().defaultTo('[]')
    table.integer('sols_offer').notNullable().defaultTo(0)
    table.timestamp('expires_at', { useTz: true }).notNullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).nullable()
  })
  await knex.raw(`
    ALTER TABLE trade_offers
      ADD CONSTRAINT chk_trade_offer_status
        CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'))
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('trade_offers')
}
