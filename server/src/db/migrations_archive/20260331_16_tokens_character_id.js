/**
 * Migration 16 — Liaison token ↔ character
 * Un token posé sur la carte peut être lié à un character de la librairie.
 * nullable — certains tokens sont des éléments de décor sans character associé.
 * SET NULL si le character est supprimé — le token reste sur la carte.
 */

export const up = async (knex) => {
  await knex.schema.alterTable('tokens', (table) => {
    table.uuid('character_id').nullable().references('id').inTable('characters').onDelete('SET NULL')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('tokens', (table) => {
    table.dropColumn('character_id')
  })
}
