// Migration 386 — PLAN_PURGE_VOXEL.md Lot 4. Renomme la table `voxel_textures` en `surface_textures`
// et la FK `battlemap_texture_usage.voxel_texture_id` en `surface_texture_id` — catalogue de textures
// réellement utilisé par `surface_data` (floorTex/ceilingTex/wallInteriorTex…), pas par un format de
// carte voxel (mort, retiré aux Lots 1-3 de ce plan). Décision de Saar (2026-10-13) : catalogue gardé,
// juste renommé pour ne plus porter le mot « voxel ». Aucune donnée supprimée, aucune ligne perdue —
// renommage structurel pur, réversible par down(). Table vide localement (0 ligne, vérifié) mais le
// renommage reste correct même avec des données (rename ne touche pas le contenu).
// Le renommage de la séquence associée (cosmétique) est dans la migration 387, séparée : nodemon a
// auto-appliqué celle-ci dès l'écriture du fichier (comportement documenté), avant qu'une édition
// suivante n'y ajoute la séquence — jamais rejoué pour ne pas empiler une correction sur une migration
// déjà exécutée.
export async function up(knex) {
  await knex.schema.renameTable('voxel_textures', 'surface_textures')
  await knex.schema.alterTable('battlemap_texture_usage', table => {
    table.renameColumn('voxel_texture_id', 'surface_texture_id')
  })
}

export async function down(knex) {
  await knex.schema.alterTable('battlemap_texture_usage', table => {
    table.renameColumn('surface_texture_id', 'voxel_texture_id')
  })
  await knex.schema.renameTable('surface_textures', 'voxel_textures')
}
