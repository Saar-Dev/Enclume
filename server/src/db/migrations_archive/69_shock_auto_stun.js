// Migration 69 — Ajoute shock_auto_stun aux campagnes (booléen, défaut true)
export const up = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.boolean('shock_auto_stun').notNullable().defaultTo(true)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('shock_auto_stun')
  })
}
