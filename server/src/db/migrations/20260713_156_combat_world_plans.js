/**
 * Migration 156 — intention de déplacement combat dans le référentiel canonique du monde.
 *
 * Les anciennes colonnes PE14 restent uniquement pour les écrans historiques. La résolution ne
 * les lit plus : elle utilise `destination_world`, l'allure serveur et les révisions du plan.
 */

export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE combat_actions
      ALTER COLUMN target_pos_x TYPE double precision USING target_pos_x::double precision,
      ALTER COLUMN target_pos_y TYPE double precision USING target_pos_y::double precision,
      ALTER COLUMN target_pos_z TYPE double precision USING target_pos_z::double precision
  `)
  await knex.schema.alterTable('combat_actions', table => {
    table.text('movement_gait').nullable()
    table.jsonb('destination_world').nullable()
    table.jsonb('world_plan').nullable()
    table.integer('planned_world_revision').nullable()
    table.integer('planned_runtime_revision').nullable()
    table.decimal('planned_budget_m', 12, 4).nullable()
  })
  // Une intention PE14 en attente ne peut pas être convertie en chemin 3D sans inventer le trajet.
  // Elle est invalidée explicitement ; les actions déjà résolues restent disponibles pour l'audit.
  await knex('combat_actions')
    .whereIn('type', ['move_short', 'move_long'])
    .where({ status: 'pending' })
    .update({ status: 'skipped', updated_at: knex.fn.now() })
  await knex.raw(`
    ALTER TABLE combat_actions
      ADD CONSTRAINT chk_combat_movement_gait
        CHECK (movement_gait IS NULL OR movement_gait IN ('lente', 'moyenne', 'rapide', 'max')),
      ADD CONSTRAINT chk_combat_destination_world
        CHECK (
          destination_world IS NULL OR (
            jsonb_typeof(destination_world) = 'object'
            AND destination_world->'x' IS NOT NULL
            AND destination_world->'y' IS NOT NULL
            AND destination_world->'z' IS NOT NULL
            AND jsonb_typeof(destination_world->'x') = 'number'
            AND jsonb_typeof(destination_world->'y') = 'number'
            AND jsonb_typeof(destination_world->'z') = 'number'
          )
        ),
      ADD CONSTRAINT chk_combat_world_plan_for_move
        CHECK (
          type NOT IN ('move_short', 'move_long') OR status <> 'pending' OR (
            movement_gait IS NOT NULL
            AND destination_world IS NOT NULL
            AND world_plan IS NOT NULL
            AND planned_world_revision IS NOT NULL
            AND planned_runtime_revision IS NOT NULL
            AND planned_budget_m IS NOT NULL
          )
        )
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE combat_actions
      DROP CONSTRAINT IF EXISTS chk_combat_world_plan_for_move,
      DROP CONSTRAINT IF EXISTS chk_combat_destination_world,
      DROP CONSTRAINT IF EXISTS chk_combat_movement_gait
  `)
  await knex.schema.alterTable('combat_actions', table => {
    table.dropColumn('movement_gait')
    table.dropColumn('destination_world')
    table.dropColumn('world_plan')
    table.dropColumn('planned_world_revision')
    table.dropColumn('planned_runtime_revision')
    table.dropColumn('planned_budget_m')
  })
  await knex.raw(`
    ALTER TABLE combat_actions
      ALTER COLUMN target_pos_x TYPE integer USING round(target_pos_x)::integer,
      ALTER COLUMN target_pos_y TYPE integer USING round(target_pos_y)::integer,
      ALTER COLUMN target_pos_z TYPE integer USING round(target_pos_z)::integer
  `)
}
