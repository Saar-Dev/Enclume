// 129_vaults.js
// PLAN_VAULT.md Étape 1 — table `vaults` (une par compte) + `characters.vault_id` (FK nullable) +
// `characters.campaign_id` devient nullable. Invariant : un personnage a exactement un des deux
// (jamais les deux, jamais aucun), imposé par une contrainte CHECK SQL — pas seulement côté service.

export const up = async (knex) => {
  await knex.schema.createTable('vaults', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('user_id').notNullable().unique()
      .references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw('ALTER TABLE characters ALTER COLUMN campaign_id DROP NOT NULL')

  await knex.schema.alterTable('characters', (table) => {
    table.uuid('vault_id').nullable()
      .references('id').inTable('vaults').onDelete('CASCADE')
  })

  await knex.raw(`
    ALTER TABLE characters
    ADD CONSTRAINT chk_characters_campaign_xor_vault
    CHECK ((campaign_id IS NULL) != (vault_id IS NULL))
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE characters DROP CONSTRAINT chk_characters_campaign_xor_vault')
  await knex.schema.alterTable('characters', (table) => {
    table.dropColumn('vault_id')
  })
  await knex.raw('ALTER TABLE characters ALTER COLUMN campaign_id SET NOT NULL')
  await knex.schema.dropTableIfExists('vaults')
}
