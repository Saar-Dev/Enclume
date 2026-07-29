// Migration 215 — docs/PLAN_BATTLEMAP2D.md §10 (Lot 5)
// characters.token_style : apparence du token 2D (forme/cadrage/bordure/overlay réservé).
// jsonb nullable, défaut null — null = comportement actuel (disque de couleur), zéro régression.
export const up = async (knex) => {
  await knex.schema.alterTable('characters', (table) => {
    table.jsonb('token_style').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('characters', (table) => {
    table.dropColumn('token_style')
  })
}
