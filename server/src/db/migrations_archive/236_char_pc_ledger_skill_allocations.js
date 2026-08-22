// 236_char_pc_ledger_skill_allocations.js
// Bug #3 (docs/BUG WIZARD.md) — getStep4State renvoyait toujours skillAllocations/
// autodidacteAllocations: {} (reconstruction depuis char_skills.mastery jugée trop risquée,
// cf. commentaire d'origine dans creationService.js). Cet écho incomplet, renvoyé même à l'auteur
// de la soumission (WIZARD_STATE_SYNC broadcast room entière), écrasait le store client, puis
// openPeek/handleTerminate le retransmettaient tel quel au serveur, qui effaçait et réinsérait
// char_skills à partir de ce payload vide — compétences remises à zéro à la finalisation.
// Fix : persister les allocations brutes telles que soumises (source unique, jamais recalculées)
// pour que l'écho serveur soit toujours fidèle.

export const up = async (knex) => {
  await knex.schema.alterTable('char_pc_ledger', (table) => {
    table.jsonb('skill_allocations').defaultTo(null)
    table.jsonb('autodidacte_allocations').defaultTo(null)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_pc_ledger', (table) => {
    table.dropColumn('skill_allocations')
    table.dropColumn('autodidacte_allocations')
  })
}
