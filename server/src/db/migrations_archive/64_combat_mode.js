export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE combat_roster
      ADD COLUMN state_combat_mode TEXT NOT NULL DEFAULT 'normal',
      ADD CONSTRAINT chk_state_combat_mode
        CHECK (state_combat_mode IN ('normal','offensif','charge','defensif','retraite'))
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE combat_roster
      DROP CONSTRAINT chk_state_combat_mode,
      DROP COLUMN state_combat_mode
  `)
}
