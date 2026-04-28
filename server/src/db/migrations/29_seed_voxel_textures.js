/**
 * Migration 29 — seed voxel_textures depuis block_types
 *
 * Convertit les 78 blocs structure-station vers voxel_textures.
 * Stocke legacy_block_type_id pour le mapping de la migration 30.
 * Conversion 'side' → bottom + north + south + east + west (P33).
 *
 * Dépend de : migration 27 (table voxel_textures), migration 24 (données block_types).
 */

const PACK_UUID = 'b4e8f2a1-9c3d-4e7f-8b2a-1d5e9f3c7b4e'

export const up = async (knex) => {
  const blocks = await knex('block_types')
    .where({ pack_id: PACK_UUID })
    .orderBy('sort_order')

  for (const block of blocks) {
    const rawFaces = block.textures  // { top?, side?, all? }
    const faces = {}

    if (rawFaces.top) faces.top = rawFaces.top
    if (rawFaces.all) faces.all = rawFaces.all
    if (rawFaces.side) {
      // 'side' = alias pour les 4 faces latérales + bottom (P33 — alias lecture seulement)
      faces.bottom = rawFaces.side
      faces.north  = rawFaces.side
      faces.south  = rawFaces.side
      faces.east   = rawFaces.side
      faces.west   = rawFaces.side
    }

    await knex('voxel_textures').insert({
      pack_id:              block.pack_id,
      category_id:          block.category_id,
      label:                block.label,
      faces:                JSON.stringify(faces),
      allowed_geometries:   null,
      deprecated:           false,
      sort_order:           block.sort_order,
      legacy_block_type_id: block.id,
    })
  }
}

export const down = async (knex) => {
  await knex('voxel_textures').where({ pack_id: PACK_UUID }).delete()
}
