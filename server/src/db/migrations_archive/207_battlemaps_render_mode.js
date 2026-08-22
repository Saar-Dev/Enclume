// Migration 207 — docs/PLAN_BATTLEMAP2D.md §6 (Lot 1). Discriminant de rendu d'une battlemap : '3d'
// (comportement actuel, valeur par défaut) ou '2d' (carte à plat, salle triviale synthétisée par le
// serveur à la création). Patron déjà en place pour ce type de discriminant (fire_mode, reload_mode,
// state_fire_mode) : table.text(...).notNullable().defaultTo(...), jamais un enum Postgres natif.

export const up = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.text('render_mode').notNullable().defaultTo('3d')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.dropColumn('render_mode')
  })
}
