/**
 * Migration 17 — Ajout de la couleur sur les tokens
 * Permet d'afficher le halo et le label dans la couleur du joueur propriétaire.
 * nullable — la couleur peut être héritée du character au moment de la création
 * ou définie explicitement. NULL = pas de couleur spécifique (token neutre GM).
 */

export const up = async (knex) => {
  await knex.schema.alterTable('tokens', (table) => {
    table.string('color', 7).nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('tokens', (table) => {
    table.dropColumn('color')
  })
}
