// Migration 250 — battlemaps.voxel_data : DROP DEFAULT non versionné (ticket SCHEMADRIFT-
// BATTLEMAPSVOXEL1). La migration d'origine (20260330_13_battlemaps_voxel_data.js) posait
// `defaultTo('[]')` — un défaut tableau alors que routes/battlemaps.js traite voxel_data comme un
// objet (rejette explicitement un tableau, ligne ~872) et que sa création ne fournit jamais
// voxel_data (dépendait entièrement de ce défaut, faux dès l'origine). Le défaut a été retiré
// directement en base à un moment donné, jamais capturé en migration — dérive constatée (column_default
// NULL en base réelle contre '[]'::jsonb attendu par l'historique des migrations). Additif pur,
// idempotent (DROP DEFAULT sur une colonne qui n'en a déjà plus est un no-op Postgres) : aucun
// changement de comportement, routes/battlemaps.js gère déjà NULL via `|| {}` au moment de la lecture.
export const up = (knex) => {
  return knex.raw('ALTER TABLE battlemaps ALTER COLUMN voxel_data DROP DEFAULT')
}

export const down = (knex) => {
  return knex.raw(`ALTER TABLE battlemaps ALTER COLUMN voxel_data SET DEFAULT '[]'::jsonb`)
}
