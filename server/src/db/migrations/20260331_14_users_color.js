/**
 * Migration 14 — Ajout de la couleur utilisateur
 * Chaque utilisateur a une couleur unique visible sur ses tokens (halo, label).
 * Les tokens GM sont neutres visuellement mais le champ est présent pour tous.
 */

export const up = async (knex) => {
  await knex.schema.alterTable('users', (table) => {
    table.string('color', 7).notNullable().defaultTo('#4A90D9')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('color')
  })
}
