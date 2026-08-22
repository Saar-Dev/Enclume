// 231_kneeling_position.js
// docs/PLANS/PLAN_KNEELING_POSITION.md Lot 2 — élargit chk_state_position (56_combat_v2.js) pour
// autoriser 'kneeling' (à genou, REGLESYSCOMBAT.md:929-930), déjà présent dans
// ref_character_state_values/character_states (229_character_states.js) mais jamais atteignable :
// combat_roster.state_position rejetait toute valeur hors standing/crouching/prone. Additif pur —
// élargit une contrainte, aucune ligne existante affectée (aucune ne vaut/ne vaudra 'kneeling' avant
// que ce Lot ne soit codé côté serveur/client).
export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE combat_roster DROP CONSTRAINT chk_state_position
  `)
  await knex.raw(`
    ALTER TABLE combat_roster
      ADD CONSTRAINT chk_state_position CHECK (state_position IN ('standing','crouching','kneeling','prone'))
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE combat_roster DROP CONSTRAINT chk_state_position
  `)
  await knex.raw(`
    ALTER TABLE combat_roster
      ADD CONSTRAINT chk_state_position CHECK (state_position IN ('standing','crouching','prone'))
  `)
}
