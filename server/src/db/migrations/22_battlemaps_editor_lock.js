/**
 * Migration 22 — battlemaps : editor_locked_by + editor_locked_until
 * Permet le lock exclusif de l'éditeur voxel par un seul GM à la fois.
 * Lock expire après 60s sans heartbeat.
 */

export const up = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.uuid('editor_locked_by').references('id').inTable('users').nullable()
    table.timestamp('editor_locked_until').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('battlemaps', (table) => {
    table.dropColumn('editor_locked_by')
    table.dropColumn('editor_locked_until')
  })
}
