// Migration 217 — docs/PLAN_FATIGUE_DOMMAGES.md §7 (Lot 1)
// Horloge de campagne : deux compteurs entiers de minutes écoulées depuis le temps zéro de campagne.
// game_time_minutes = compteur affiché/narratif, déplaçable dans les deux sens par le MJ.
// game_time_resolved_minutes = repère mécanique interne, strictement non-décroissant, jamais affiché.
// integer (pas bigint) : voir Architecture retenue du plan — pg-types désérialise bigint en string,
// integer couvre ±4084 ans de temps de jeu en minutes, marge massive pour toute campagne. Rétrocompatible.
export const up = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.integer('game_time_minutes').notNullable().defaultTo(0)
    table.integer('game_time_resolved_minutes').notNullable().defaultTo(0)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('game_time_minutes')
    table.dropColumn('game_time_resolved_minutes')
  })
}
