/**
 * Migration 21 — texture_packs
 * Table des packs de textures voxel.
 * name unique — chemin MinIO : textures/<name>/
 */

export const up = async (knex) => {
  await knex.schema.createTable('texture_packs', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.string('name').notNullable().unique()   // ex: "structure-station"
    table.string('label').notNullable()           // ex: "Structure de station"
    table.text('description').nullable()
    table.integer('tile_size').defaultTo(128)     // résolution px — 64/128/256
    table.uuid('created_by').references('id').inTable('users').nullable()
    table.timestamps(true, true)
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('texture_packs')
}
