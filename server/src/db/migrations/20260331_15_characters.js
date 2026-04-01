/**
 * Migration 15 — Table characters
 * Un character = toute entité de la librairie : PJ, PNJ, véhicule, drone, etc.
 * user_id nullable — NULL signifie entité GM (PNJ, objet interactif).
 * glb_url et portrait_url prévus mais non utilisés en V1 (upload Phase suivante).
 * visible contrôle la visibilité de l'entité pour les joueurs dans la librairie.
 */

export const up = async (knex) => {
  await knex.schema.createTable('characters', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.string('name', 100).notNullable()
    table.string('color', 7).notNullable().defaultTo('#4A90D9')
    table.boolean('visible').notNullable().defaultTo(true)
    table.text('glb_url').nullable()
    table.text('portrait_url').nullable()
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
  })
}

export const down = async (knex) => {
  await knex.schema.dropTable('characters')
}
