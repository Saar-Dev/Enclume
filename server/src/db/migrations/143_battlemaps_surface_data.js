/**
 * Migration 143 — battlemaps.surface_data
 *
 * Nouveau stockage pour le moteur grille/surfaces/murs (fusion frontend Kiwi). Il reste distinct
 * de voxel_data afin de pouvoir abandonner le rendu cube sans casser les cartes historiques
 * pendant la transition.
 */

export const up = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.jsonb('surface_data').notNullable().defaultTo('{}')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.dropColumn('surface_data')
  })
}
