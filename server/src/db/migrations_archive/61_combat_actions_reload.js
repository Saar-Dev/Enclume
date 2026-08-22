// Migration 61 — Ajoute 'reload' au CHECK constraint de combat_actions.type
export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE combat_actions
      DROP CONSTRAINT chk_action_type,
      ADD CONSTRAINT chk_action_type
        CHECK (type IN ('assault','move_short','move_long','micro','skip','reload'))
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE combat_actions
      DROP CONSTRAINT chk_action_type,
      ADD CONSTRAINT chk_action_type
        CHECK (type IN ('assault','move_short','move_long','micro','skip'))
  `)
}
