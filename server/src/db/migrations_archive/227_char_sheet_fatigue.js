// char_sheet.fatigue_points — Compteur de Fatigue (docs/PLAN_FATIGUE_DOMMAGES.md §10 Lot 4).
// Un seul entier persistant, 0 à 17 (6 paliers × 3 cases, Annexe p.250 du Livre de Base) — palier =
// floor(points/3), case = points%3. Autorité unique, même principe que campaigns.game_time_minutes
// (Lot 1) : jamais palier/case stockés séparément (désynchronisation possible). Additive, notNullable
// defaultTo(0) : rétrocompatible, tous les personnages existants démarrent à Normal/case 0.
export const up = async (knex) => {
  await knex.schema.alterTable('char_sheet', (table) => {
    table.integer('fatigue_points').notNullable().defaultTo(0)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_sheet', (table) => {
    table.dropColumn('fatigue_points')
  })
}
