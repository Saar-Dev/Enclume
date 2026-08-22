/**
 * Migration 43 — entity_blueprints.pack_id + voxel_textures.usage_hint
 *
 * Deux altérations liées au chantier 9D (Atelier du GM — onglet Entités).
 *
 * 1. entity_blueprints.pack_id
 *    Un blueprint appartient désormais à un pack de textures.
 *    Nullable — les blueprints existants (legacy) ont pack_id = null.
 *    Guard obligatoire avant tout accès à pack_id côté client (PE18).
 *
 * 2. voxel_textures.usage_hint
 *    Hint de tri optionnel pour le sélecteur de faces dans l'Atelier.
 *    Valeurs : 'voxel' | 'entity' | 'both' | null
 *    null = utilisable partout — comportement par défaut.
 *    JAMAIS exclusif — c'est un hint de tri, pas une règle métier (PE17).
 *    "Voir tout" toujours disponible dans l'interface.
 *
 * down : supprime les deux colonnes dans l'ordre inverse du up.
 */

export const up = async (knex) => {
  await knex.schema.alterTable('entity_blueprints', (table) => {
    table.uuid('pack_id').references('id').inTable('texture_packs').nullable()
  })
  await knex.schema.alterTable('voxel_textures', (table) => {
    table.string('usage_hint').nullable()
    // 'voxel' | 'entity' | 'both' | null (null = les deux)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('voxel_textures', (table) => {
    table.dropColumn('usage_hint')
  })
  await knex.schema.alterTable('entity_blueprints', (table) => {
    table.dropColumn('pack_id')
  })
}
