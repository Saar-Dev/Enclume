/**
 * Migration 153 — frontière explicite entre positions legacy et positions canoniques.
 *
 * Les lignes existantes restent marquées legacy-cell : aucune conversion approximative n'est
 * tentée. Les nouveaux tokens utilisent des coordonnées world-feet (point des pieds, axes PE14).
 */

export const up = async (knex) => {
  await knex.schema.alterTable('battlemaps', table => {
    table.integer('runtime_revision').notNullable().defaultTo(0)
  })
  await knex.schema.alterTable('tokens', table => {
    table.text('position_space').notNullable().defaultTo('legacy-cell')
  })
  await knex.raw(`
    ALTER TABLE tokens
      ALTER COLUMN position_space SET DEFAULT 'world-feet',
      ADD CONSTRAINT chk_tokens_position_space
        CHECK (position_space IN ('legacy-cell', 'world-feet'))
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE tokens DROP CONSTRAINT IF EXISTS chk_tokens_position_space')
  await knex.schema.alterTable('tokens', table => table.dropColumn('position_space'))
  await knex.schema.alterTable('battlemaps', table => table.dropColumn('runtime_revision'))
}
