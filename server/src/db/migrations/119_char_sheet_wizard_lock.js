/**
 * Migration 119 — char_sheet.wizard_locked_at
 *
 * Sépare la propriété "assistant" (rejouable, reconciliation à chaque ouverture
 * de la fenêtre fiche personnage pendant le Wizard) de la propriété "runtime"
 * (fiche réelle post-verrouillage, éditable librement en session de jeu).
 * NULL tant que le joueur n'a pas cliqué "Terminer" — voir docs/STE6_FINAL.md.
 */

export const up = async (knex) => {
  await knex.schema.alterTable('char_sheet', (table) => {
    table.timestamp('wizard_locked_at').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_sheet', (table) => {
    table.dropColumn('wizard_locked_at')
  })
}
