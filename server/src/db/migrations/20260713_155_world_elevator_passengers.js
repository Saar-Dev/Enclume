/**
 * Migration 155 — passagers attachés au repère local d'une cabine d'ascenseur.
 *
 * L'état cinématique et la file d'appels restent dans `world_feature_states`. Cette table ne
 * conserve que le lien token/cabine et la position locale : une réconciliation après redémarrage
 * suffit donc à replacer exactement tous les passagers.
 */

export const up = async (knex) => {
  await knex.schema.createTable('world_elevator_passengers', table => {
    table.uuid('battlemap_id').notNullable().references('id').inTable('battlemaps').onDelete('CASCADE')
    table.uuid('elevator_id').notNullable()
    table.uuid('token_id').notNullable().references('id').inTable('tokens').onDelete('CASCADE')
    table.jsonb('local_position').notNullable()
    table.timestamp('boarded_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    table.primary(['battlemap_id', 'elevator_id', 'token_id'])
    table.unique(['token_id'])
    table.index(['battlemap_id', 'elevator_id'])
  })

  await knex.raw(`
    ALTER TABLE world_elevator_passengers
      ADD CONSTRAINT chk_world_elevator_local_position
      CHECK (
        jsonb_typeof(local_position) = 'object'
        AND local_position->'x' IS NOT NULL
        AND local_position->'y' IS NOT NULL
        AND local_position->'z' IS NOT NULL
        AND jsonb_typeof(local_position->'x') = 'number'
        AND jsonb_typeof(local_position->'y') = 'number'
        AND jsonb_typeof(local_position->'z') = 'number'
      )
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('world_elevator_passengers')
}
