// campaigns.pending_advance_* — mécanisme d'avance en attente du Lot 2 (docs/PLAN_FATIGUE_DOMMAGES.md
// §8). pending_advance_delta_minutes non nul = un saut de temps est en attente d'une revue MJ/joueur
// ; verrou "un seul saut à la fois" par campagne (Point D confirmé, Saar 2026-07-29), compromis
// assumé plutôt qu'un oubli. pending_advance_undo_log accumule les undoEntries { table, rowId,
// previousValues } que chaque handler résolu produit lui-même (jamais déduites par le moteur) —
// rejoué en sens inverse par cancelPendingAdvance, vidé à chaque commit ou annulation.
export const up = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.integer('pending_advance_delta_minutes').nullable()
    table.jsonb('pending_advance_undo_log').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('pending_advance_delta_minutes')
    table.dropColumn('pending_advance_undo_log')
  })
}
