/**
 * Migration 23 — texture_pack_categories + block_types
 *
 * ORDRE OBLIGATOIRE : texture_pack_categories AVANT block_types (FK).
 *
 * block_types.id : integer auto-incrémenté — exception justifiée à la convention UUID.
 * Stocké dans JSONB voxel_data — jamais utilisé comme FK typée dans Knex.
 * Compact (1-4 chars vs 36) — essentiel pour la taille du JSONB.
 */

export const up = async (knex) => {
  // 1. texture_pack_categories — AVANT block_types (FK category_id)
  await knex.schema.createTable('texture_pack_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('pack_id').references('id').inTable('texture_packs').notNullable()
    table.string('label').notNullable()
    table.integer('sort_order').defaultTo(0)
  })

  // 2. block_types — APRÈS texture_pack_categories
  await knex.schema.createTable('block_types', (table) => {
    table.increments('id')   // INTEGER auto — exception justifiée, jamais FK typée
    table.uuid('pack_id').references('id').inTable('texture_packs').notNullable()
    table.string('label').notNullable()
    table.string('geometry').notNullable()  // cube/slab_bottom/slab_top/slope/wedge
    table.jsonb('textures').notNullable()   // { all?, top?, bottom?, side? }
    table.boolean('deprecated').defaultTo(false)
    table.integer('sort_order').defaultTo(0)
    table.uuid('category_id').references('id').inTable('texture_pack_categories').nullable()
    table.timestamps(true, true)
  })
}

export const down = async (knex) => {
  // Ordre inverse — block_types AVANT texture_pack_categories (FK)
  await knex.schema.dropTableIfExists('block_types')
  await knex.schema.dropTableIfExists('texture_pack_categories')
}
