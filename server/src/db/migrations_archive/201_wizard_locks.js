// Migration 201 — docs/PLAN_WIZARDCOLLAB.md Lot A1. Table des verrous MJ posés pendant le Wizard
// collaboratif : un triplet (char_sheet_id, step, option_key) gèle une option précise (empêche le
// joueur de la choisir ou de la retirer, cf. algorithme reconcileCreation/enforceWizardLocks). Une
// absence de ligne signifie option libre — pas de colonne booléenne, l'existence de la ligne EST le
// verrou.
//
// Nettoyée explicitement à la finalisation (lockWizard) : le ON DELETE CASCADE ne joue qu'à la
// suppression de char_sheet, jamais à la bascule brouillon → personnage réel.

export const up = async (knex) => {
  await knex.schema.createTable('wizard_locks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('char_sheet_id')
      .notNullable()
      .references('id').inTable('char_sheet')
      .onDelete('CASCADE')
    table.integer('step').notNullable()
    table.text('option_key').notNullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())

    table.unique(['char_sheet_id', 'step', 'option_key'])
  })

  await knex.raw(`
    ALTER TABLE wizard_locks
    ADD CONSTRAINT chk_wizard_locks_step CHECK (step BETWEEN 1 AND 5)
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTable('wizard_locks')
}
