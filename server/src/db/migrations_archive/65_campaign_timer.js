export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE campaigns
      ADD COLUMN action_timer_sec INTEGER NOT NULL DEFAULT 0
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE campaigns
      DROP COLUMN action_timer_sec
  `)
}
