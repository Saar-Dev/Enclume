export const up = async (knex) => {
  // ── combat_actions : données assaut enrichies (Sprint 7.1) ───────────────
  await knex.schema.alterTable('combat_actions', (table) => {
    table.text('fire_mode').nullable()
    table.smallint('bullet_count').nullable()
    table.smallint('fire_mode_bonus_comp').nullable()
    table.smallint('fire_mode_bonus_dmg').nullable()
  })

  // ── combat_roster : flags par tour (JSONB) ────────────────────────────────
  // PC39 — merge obligatoire, jamais de remplacement direct
  await knex.schema.alterTable('combat_roster', (table) => {
    table.jsonb('state_character').notNullable().defaultTo('{}')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('combat_roster', (table) => {
    table.dropColumn('state_character')
  })
  await knex.schema.alterTable('combat_actions', (table) => {
    table.dropColumn('fire_mode_bonus_dmg')
    table.dropColumn('fire_mode_bonus_comp')
    table.dropColumn('bullet_count')
    table.dropColumn('fire_mode')
  })
}
