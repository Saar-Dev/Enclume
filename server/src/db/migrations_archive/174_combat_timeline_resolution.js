// docs/PLAN_COMBAT_TIMELINE.md Lot B — moteur de résolution générique.
// 1. combat_state.sub_phase : nouvelle valeur AWAITING_REACTION_WINDOW (§6ter point 3).
// 2. combat_state.active_slot_idx : colonne morte — le moteur de résolution ne parcourt plus
//    combat_roster trié par initiative via un index, il relit combat_timeline_entries en direct
//    (pickNextTimelineStep, §6ter point 1 : « pas de curseur dupliqué »). Dernier lecteur retiré
//    dans ce Lot (socketCombatHelpers.js/socketCombatResolution.js) — colonne réellement inutilisée.
export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE combat_state DROP CONSTRAINT chk_combat_sub_phase
  `)
  await knex.raw(`
    ALTER TABLE combat_state ADD CONSTRAINT chk_combat_sub_phase
      CHECK (sub_phase IN ('SLOT_ACTIVE','AWAITING_DEFENSE','AWAITING_DAMAGE','AWAITING_REACTION_WINDOW'))
  `)
  await knex.schema.alterTable('combat_state', (table) => {
    table.dropColumn('active_slot_idx')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('combat_state', (table) => {
    table.integer('active_slot_idx').notNullable().defaultTo(0)
  })
  await knex.raw(`
    ALTER TABLE combat_state DROP CONSTRAINT chk_combat_sub_phase
  `)
  await knex.raw(`
    ALTER TABLE combat_state ADD CONSTRAINT chk_combat_sub_phase
      CHECK (sub_phase IN ('SLOT_ACTIVE','AWAITING_DEFENSE','AWAITING_DAMAGE'))
  `)
}
