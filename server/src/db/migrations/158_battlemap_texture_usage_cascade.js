/**
 * Migration 158 — CASCADE manquant sur battlemap_texture_usage.battlemap_id
 *
 * battlemap_texture_usage (migration 28) référence battlemaps.id sans ON DELETE
 * CASCADE — contrairement à toutes les autres tables enfants d'une campagne/
 * battlemap. Une battlemap avec des lignes d'usage de texture ne peut donc pas être
 * supprimée (et par cascade, DELETE /api/campaigns/:id échoue dès qu'une des
 * battlemaps de la campagne a des textures posées). Table toujours active des deux
 * côtés (voxel legacy et surface_data — server/src/services/battlemapWorldPersistence.js
 * syncBattlemapTextureUsage), pas une relique — seule la règle de suppression manquait.
 *
 * voxel_texture_id (référence voxel_textures) n'est pas touché ici — hors scope,
 * aucun blocage constaté sur cette colonne.
 */

export const up = async (knex) => {
  await knex.schema.alterTable('battlemap_texture_usage', table => {
    table.dropForeign('battlemap_id')
    table.foreign('battlemap_id').references('id').inTable('battlemaps').onDelete('CASCADE')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('battlemap_texture_usage', table => {
    table.dropForeign('battlemap_id')
    table.foreign('battlemap_id').references('id').inTable('battlemaps')
  })
}
