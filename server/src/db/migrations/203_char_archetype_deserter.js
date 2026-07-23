// Migration 203 — docs/PLAN_WIZARDCOLLAB.md Lot A3. `isDeserter` (Step2, réduit le coût PC d'un
// génotype à option Déserteur de 4 PC) n'était jamais persisté — seul son effet (le coût 4 PC déjà
// écrit dans char_pc_ledger.pc_spent_step2) l'était. Sans cette colonne, GET /:sheetId/state ne
// peut pas reconstruire fidèlement l'état Step2 d'un brouillon existant (le MJ ouvrant la fiche
// d'un joueur verrait la case Déserteur toujours décochée, même si le joueur l'a cochée).

export const up = async (knex) => {
  await knex.schema.alterTable('char_archetype', (table) => {
    table.boolean('is_deserter').notNullable().defaultTo(false)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_archetype', (table) => {
    table.dropColumn('is_deserter')
  })
}
