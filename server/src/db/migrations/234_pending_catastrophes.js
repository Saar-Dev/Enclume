// Migration 234 — pending_catastrophes (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1) : file d'attente
// serveur des Catastrophes automatiques en combat en attente de validation MJ. Source de vérité
// persistée (pas de l'éphémère client seul, voir §4/§8 du plan — perdre une Catastrophe non résolue
// en mémoire côté client la ferait disparaître silencieusement, contrairement à
// EnvironmentalResultQueue.jsx qui n'est que display-only). Purgée à COMBAT_END
// (socketCombatState.js), même patron que combat_pending/combat_roster.
export const up = async (knex) => {
  await knex.schema.createTable('pending_catastrophes', (table) => {
    table.increments('id')
    table.uuid('campaign_id').notNullable()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('token_id').notNullable()
      .references('id').inTable('tokens').onDelete('CASCADE')
    // table_entry — le résultat du jet 1D10 tel quel, immuable (jamais réécrit après coup).
    table.integer('table_entry').notNullable()
    // applied_entry — ce qui est réellement appliqué après validation MJ (§4) : égal à table_entry
    // si le MJ confirme tel quel, différent s'il override (entrée alternative 1-10). NULL tant que
    // resolved_at est NULL.
    table.integer('applied_entry').nullable()
    // context — forme minimale requise (§4) : { site, actorTokenId, targetTokenId }.
    table.jsonb('context').notNullable().defaultTo('{}')
    table.timestamp('rolled_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('resolved_at').nullable()
    table.uuid('resolved_by').nullable()
      .references('id').inTable('users').onDelete('SET NULL')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTable('pending_catastrophes')
}
