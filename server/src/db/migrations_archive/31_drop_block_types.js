/**
 * Migration 31 — drop block_types + nettoyage
 *
 * IRRÉVERSIBLE.
 * À placer dans le dossier migrations UNIQUEMENT après validation du Batch 1
 * (migrations 27 à 30 vérifiées en base).
 *
 * Ordre de drop obligatoire :
 *   1. legacy_block_type_id (colonne sur voxel_textures) — plus besoin après 30
 *   2. battlemap_block_usage (FK block_type_id → block_types) — avant drop de block_types
 *   3. block_types — dernière, après suppression de ses référençants
 */

export const up = async (knex) => {
  // 1. Dropper legacy_block_type_id (colonne temporaire migration 29)
  await knex.schema.alterTable('voxel_textures', (table) => {
    table.dropColumn('legacy_block_type_id')
  })
  // 2. Dropper battlemap_block_usage (ancienne table — FK block_type_id → block_types)
  await knex.schema.dropTableIfExists('battlemap_block_usage')
  // 3. Dropper block_types (ancienne table — FK vers texture_packs/categories, pas vers voxel_data)
  await knex.schema.dropTableIfExists('block_types')
}

export const down = async (knex) => {
  console.warn('[Migration 31] down : non réversible')
}
