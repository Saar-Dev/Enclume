export const up = async (knex) => {
  // ── combat_roster : états tactiques per-turn + mode de tir persistant ──────
  await knex.schema.alterTable('combat_roster', (table) => {
    table.text('state_cover').notNullable().defaultTo('exposed')
    table.text('state_fire_mode').notNullable().defaultTo('cc')
    table.text('state_vitesse').notNullable().defaultTo('normal')
  })
  await knex.raw(`
    ALTER TABLE combat_roster
      ADD CONSTRAINT chk_state_cover     CHECK (state_cover     IN ('exposed','partial','important')),
      ADD CONSTRAINT chk_state_fire_mode CHECK (state_fire_mode IN ('cc','rc','rl')),
      ADD CONSTRAINT chk_state_vitesse   CHECK (state_vitesse   IN ('normal','delayed','rushed'))
  `)

  // Backfill state_vitesse depuis is_rushed (JSONB) — is_rushed:true → 'rushed'
  await knex.raw(`
    UPDATE combat_roster
    SET state_vitesse = 'rushed'
    WHERE state_character->>'is_rushed' = 'true'
  `)
}

export const down = async (knex) => {
  // Les CHECKs sont supprimés automatiquement par PostgreSQL avec DROP COLUMN
  await knex.schema.alterTable('combat_roster', (table) => {
    table.dropColumn('state_vitesse')
    table.dropColumn('state_fire_mode')
    table.dropColumn('state_cover')
  })
}
