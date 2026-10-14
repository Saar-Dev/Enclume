// Migration 387 — complète la migration 386 (PLAN_PURGE_VOXEL.md Lot 4) : nodemon a auto-appliqué 386
// dès son écriture (comportement documenté, .claude/rules/migrations.md), avant que le renommage de la
// séquence n'y soit ajouté par une édition suivante du même fichier — jamais rejoué pour ne pas empiler
// une correction sur une migration déjà exécutée (règle du projet). Migration séparée à la place, pur
// cosmétique (une séquence n'est jamais référencée par son nom dans le code, seulement par ownership
// interne Postgres).
export async function up(knex) {
  await knex.raw('ALTER SEQUENCE "voxel_textures_id_seq" RENAME TO "surface_textures_id_seq"')
}

export async function down(knex) {
  await knex.raw('ALTER SEQUENCE "surface_textures_id_seq" RENAME TO "voxel_textures_id_seq"')
}
