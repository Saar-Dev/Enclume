/**
 * Migration 26 — battlemap_block_usage
 *
 * Index des blocs utilisés par battlemap.
 * Permet DELETE /api/block-types/:id en O(1) sans scan JSONB.
 * Recalculé automatiquement par PUT /battlemaps/:id/voxels après chaque save.
 *
 * PK composite (battlemap_id, block_type_id) — un bloc par battlemap, une seule fois.
 * block_type_id est integer (exception justifiée — block_types.id est increments).
 */

export const up = async (knex) => {
  await knex.schema.createTable('battlemap_block_usage', (table) => {
    table.uuid('battlemap_id').references('id').inTable('battlemaps').notNullable()
    table.integer('block_type_id').references('id').inTable('block_types').notNullable()
    table.primary(['battlemap_id', 'block_type_id'])
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('battlemap_block_usage')
}
