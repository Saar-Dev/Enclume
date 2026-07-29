// Migration 213 — docs/PLAN_BATTLEMAP2D.md §9 (Lot 4). Arborescence de dossiers pour le sélecteur de
// cartes (liste d'adjacence, comme Foundry VTT — un Folder avec un pointeur parent, jamais un chemin
// texte). `battlemaps.folder_id` remplace `battlemaps.folder` (text, jamais utilisé côté client,
// vérifié vide en base avant suppression — 0 ligne avec une valeur non nulle, 2026-07-29).

export const up = async (knex) => {
  await knex.schema.createTable('battlemap_folders', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('parent_folder_id').nullable()
      .references('id').inTable('battlemap_folders').onDelete('CASCADE')
    table.text('name').notNullable()
    table.timestamps(true, true)
  })

  await knex.schema.alterTable('battlemaps', (table) => {
    table.uuid('folder_id').nullable()
      .references('id').inTable('battlemap_folders').onDelete('CASCADE')
    table.dropColumn('folder')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.text('folder')
    table.dropColumn('folder_id')
  })
  await knex.schema.dropTable('battlemap_folders')
}
