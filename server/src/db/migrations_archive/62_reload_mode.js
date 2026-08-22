// Migration 62 — Ajoute reload_mode aux campagnes ('magazine' | 'topup')
export const up = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.text('reload_mode').notNullable().defaultTo('magazine')
  })
  await knex.raw(`
    ALTER TABLE campaigns
      ADD CONSTRAINT chk_reload_mode CHECK (reload_mode IN ('magazine', 'topup'))
  `)
}

export const down = async (knex) => {
  await knex.raw(`ALTER TABLE campaigns DROP CONSTRAINT chk_reload_mode`)
  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('reload_mode')
  })
}
