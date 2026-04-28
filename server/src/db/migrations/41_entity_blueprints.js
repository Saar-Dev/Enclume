/**
 * Migration 41 — Entités : table entity_blueprints
 *
 * Crée la table entity_blueprints — modèles réutilisables d'entités interactables.
 * Un blueprint définit l'apparence (geometry, glb_url), les états possibles (states)
 * et les interactions disponibles (interactions).
 *
 * Une modification de blueprint ne se répercute PAS sur les instances déjà posées.
 * Un blueprint utilisé par des instances existantes ne peut pas être supprimé —
 * utiliser deprecated = true pour le désactiver (pattern identique à voxel_textures).
 *
 * Colonnes JSONB :
 *   geometry     : { width, height, depth, faces: { top, bottom, north, south, east, west } }
 *                  faces = IDs voxel_textures.id (integer) ou null (face invisible)
 *   states       : [{ id, name, is_blocking, is_transparent, visual_override: { opacity, face_overrides } }]
 *   interactions : [{ id, action_label, required_state_ids, target_state_id, skill_id, difficulty_dc, range }]
 *
 * down : supprime la table (CASCADE supprimera entities via FK dans migration 42).
 */

export const up = async (knex) => {
  await knex.schema.createTable('entity_blueprints', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
    table.text('label').notNullable()
    table.text('glb_url').nullable()
      // Chemin MinIO si modèle GLB — null si apparence voxel (geometry + faces)
    table.jsonb('geometry').notNullable().defaultTo('{}')
      // { width, height, depth, faces: { top, bottom, north, south, east, west } }
      // faces = IDs voxel_textures.id ou null (face invisible)
    table.jsonb('states').notNullable().defaultTo('[]')
      // [{ id, name, is_blocking, is_transparent, visual_override: { opacity, face_overrides } }]
    table.jsonb('interactions').notNullable().defaultTo('[]')
      // [{ id, action_label, required_state_ids, target_state_id, skill_id, difficulty_dc, range }]
    table.boolean('deprecated').notNullable().defaultTo(false)
      // true = masqué de la palette, non supprimé — pattern identique à voxel_textures
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('entity_blueprints')
}
