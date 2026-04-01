/**
 * Migration 18 — Champs texte sur characters
 * description : visible par tous les membres
 * gm_notes    : visible GM uniquement — filtrage côté route, pas en base
 */

export const up = async (knex) => {
  await knex.schema.alterTable('characters', (table) => {
    table.text('description').nullable()
    table.text('gm_notes').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('characters', (table) => {
    table.dropColumn('description')
    table.dropColumn('gm_notes')
  })
}
