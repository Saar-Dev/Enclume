/**
 * Migration 28 — table battlemap_texture_usage
 *
 * Index des textures utilisées par battlemap.
 * Permet la vérification DELETE /voxel-textures/:id en O(1) sans scan JSONB.
 * Recalculée dans PUT /battlemaps/:id/voxels après chaque save.
 * Remplace battlemap_block_usage (droppée en migration 31).
 */

export const up = async (knex) => {
  await knex.schema.createTable('battlemap_texture_usage', (table) => {
    table.uuid('battlemap_id').references('id').inTable('battlemaps').notNullable()
    table.integer('voxel_texture_id').references('id').inTable('voxel_textures').notNullable()
    table.primary(['battlemap_id', 'voxel_texture_id'])
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('battlemap_texture_usage')
}
