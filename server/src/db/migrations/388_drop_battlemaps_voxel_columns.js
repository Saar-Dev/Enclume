// Migration 388 — PLAN_PURGE_VOXEL.md Lot 5 (dernier lot, destructif). Supprime les 3 colonnes mortes
// de `battlemaps` : `voxel_data` (format de carte voxel, retiré Lots 1-3, zéro code ne le lit/écrit
// plus), `voxel_revision` (protégeait son pipeline de sauvegarde, retiré Lot 2), `voxel_scale`
// (jamais consommée pour un calcul réel — codée en dur à 1.0 partout, `CombatModifiersWindow.jsx`,
// l'UI de réglage prévue n'a jamais existé). Décision de Saar (2026-10-14) : accord explicite donné,
// sans sauvegarde préalable (demande explicite, garde-fou §0 du plan levé par lui pour cette étape
// précise). Vérifié avant d'écrire cette migration : zéro référence vivante aux 3 colonnes dans
// client/src, server/src (hors scripts de ticket historiques, jamais réécrits) et shared/.
export async function up(knex) {
  await knex.schema.alterTable('battlemaps', table => {
    table.dropColumn('voxel_data')
    table.dropColumn('voxel_revision')
    table.dropColumn('voxel_scale')
  })
}

export async function down(knex) {
  await knex.schema.alterTable('battlemaps', table => {
    table.jsonb('voxel_data')
    table.integer('voxel_revision').notNullable().defaultTo(0)
    table.float('voxel_scale').notNullable().defaultTo(1.0)
  })
}
