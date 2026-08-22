/**
 * Migration 27 — table voxel_textures
 *
 * Source de vérité des textures — remplace block_types.
 * IDs auto-incrémentés globaux (même exception UUID que block_types — P22).
 * legacy_block_type_id : colonne temporaire pour le mapping migration 30.
 * Droppée en migration 31.
 */

export const up = async (knex) => {
  await knex.schema.createTable('voxel_textures', (table) => {
    table.increments('id')
    // INTEGER auto — exception justifiée à la convention UUID :
    //   compact (1-4 chars vs 36), stocké dans JSONB, jamais FK typée
    table.uuid('pack_id').references('id').inTable('texture_packs').notNullable()
    table.uuid('category_id').references('id').inTable('texture_pack_categories').nullable()
    table.string('label').notNullable()
    table.jsonb('faces').notNullable()
    // { top?, bottom?, north?, south?, east?, west?, all? }
    // 'side' accepté en lecture uniquement (alias rétrocompat → north/south/east/west)
    table.jsonb('allowed_geometries').nullable()
    // null = toutes géométries autorisées
    // Array JSON : ["cube","slab_bottom"] = restreint
    // [] = aucune géométrie autorisée (équivalent deprecated)
    table.boolean('deprecated').defaultTo(false)
    table.integer('sort_order').defaultTo(0)
    table.integer('legacy_block_type_id').nullable()
    // Colonne temporaire — mapping block_types.id → voxel_textures.id pour migration 30
    // Droppée en migration 31
    table.timestamps(true, true)
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('voxel_textures')
}
