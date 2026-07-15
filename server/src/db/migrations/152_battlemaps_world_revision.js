/**
 * Migration 152 — révisions indépendantes des sources physiques et révision globale du monde.
 *
 * world_revision change dès qu'une source du monde change. surface_revision et voxel_revision
 * permettent l'optimistic locking sans créer de faux conflit entre les deux autosaves séparées.
 */

import { prepareSurfaceData } from '../../../../shared/world/surfaceDocument.js'

export const up = async (knex) => {
  await knex.schema.alterTable('battlemaps', table => {
    table.integer('world_revision').notNullable().defaultTo(0)
    table.integer('surface_revision').notNullable().defaultTo(0)
    table.integer('voxel_revision').notNullable().defaultTo(0)
  })

  const battlemaps = await knex('battlemaps').select('id', 'surface_data')
  for (const battlemap of battlemaps) {
    const prepared = prepareSurfaceData(battlemap.surface_data || {}, { battlemapId: battlemap.id })
    if (!prepared.changed) continue
    await knex('battlemaps')
      .where({ id: battlemap.id })
      .update({ surface_data: JSON.stringify(prepared.surfaceData) })
  }
}

export const down = async (knex) => {
  await knex.schema.alterTable('battlemaps', table => {
    table.dropColumn('voxel_revision')
    table.dropColumn('surface_revision')
    table.dropColumn('world_revision')
  })
}
