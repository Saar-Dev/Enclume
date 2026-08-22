// Migration 84 — Table merchants
// Marchands configurés par le GM par campagne.
// allowed_char_ids TEXT[] : liste blanche personnages (vide = tous autorisés).
// rules JSONB : filtres inclusion/exclusion catalogue (FAM/CAT/ITEM + PARAM).

export const up = async (knex) => {
  await knex.schema.createTable('merchants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('campaign_id').notNullable()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    table.text('name').notNullable()
    table.text('status').notNullable().defaultTo('CLOSED')
    table.integer('mod_global').notNullable().defaultTo(0)
    table.integer('nt_max').notNullable().defaultTo(6)
    table.integer('niv_max').notNullable().defaultTo(5)
    table.integer('gen_max').notNullable().defaultTo(5)
    table.integer('dispo_min').nullable()
    table.jsonb('rules').notNullable().defaultTo('[]')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.raw(`
    ALTER TABLE merchants
      ADD COLUMN allowed_char_ids TEXT[] NOT NULL DEFAULT '{}',
      ADD CONSTRAINT chk_merchant_status CHECK (status IN ('OPEN', 'CLOSED'))
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('merchants')
}
