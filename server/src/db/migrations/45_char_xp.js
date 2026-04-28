/**
 * 45_char_xp.js — Ajout colonnes XP sur char_sheet
 *
 * Ajoute deux colonnes sur char_sheet :
 *   xp_total     INT NOT NULL DEFAULT 0 — XP total reçus (cumulatif)
 *   xp_available INT NOT NULL DEFAULT 0 — XP disponibles à dépenser
 *
 * Le GM modifie ces valeurs via PUT /api/char-sheet/:characterId/xp.
 * Le joueur dépense xp_available via POST /api/char-sheet/:characterId/skills/buy.
 *
 * Pas de table char_xp_log en V1 — backlog UX1, session future.
 */

export async function up(knex) {
  await knex.schema.alterTable('char_sheet', (table) => {
    table.integer('xp_total').notNullable().defaultTo(0)
    table.integer('xp_available').notNullable().defaultTo(0)
  })
}

export async function down(knex) {
  await knex.schema.alterTable('char_sheet', (table) => {
    table.dropColumn('xp_total')
    table.dropColumn('xp_available')
  })
}
