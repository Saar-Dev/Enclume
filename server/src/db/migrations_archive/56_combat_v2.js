export const up = async (knex) => {
  // ── combat_actions : passage au command queue ─────────────────────────────
  // Ajouter les nouvelles colonnes (action_key nullable d'abord pour le backfill)
  await knex.schema.alterTable('combat_actions', (table) => {
    table.text('action_key')
    table.smallint('sequence').defaultTo(0)
    table.integer('target_pos_x').nullable()
    table.integer('target_pos_y').nullable()
    table.integer('target_pos_z').nullable()
  })
  // Backfill action_key depuis type, puis passer NOT NULL
  await knex.raw('UPDATE combat_actions SET action_key = type')
  await knex.raw('ALTER TABLE combat_actions ALTER COLUMN action_key SET NOT NULL')
  // Supprimer les anciennes colonnes (remplacées par action_key + target_pos_x/y/z)
  await knex.raw('ALTER TABLE combat_actions DROP COLUMN is_micro')
  await knex.raw('ALTER TABLE combat_actions DROP COLUMN initiative_score')
  await knex.raw('ALTER TABLE combat_actions DROP COLUMN target_pos')
  // Nouveaux indexes (idx_actions_key sera auto-droppé si action_key droppé en down)
  await knex.raw('CREATE INDEX idx_actions_token ON combat_actions(campaign_id, token_id)')
  await knex.raw('CREATE INDEX idx_actions_key   ON combat_actions(campaign_id, action_key)')

  // ── combat_roster : états personnage persistants entre les tours ──────────
  await knex.schema.alterTable('combat_roster', (table) => {
    table.text('state_position').notNullable().defaultTo('standing')
    table.text('state_weapon').notNullable().defaultTo('holstered')
  })
  await knex.raw(`
    ALTER TABLE combat_roster
      ADD CONSTRAINT chk_state_position CHECK (state_position IN ('standing','crouching','prone')),
      ADD CONSTRAINT chk_state_weapon   CHECK (state_weapon   IN ('holstered','ready','drawn'))
  `)

  // ── battlemaps : échelle numérique (UI GM reportée sprint ScaleMap) ───────
  await knex.schema.alterTable('battlemaps', (table) => {
    table.float('voxel_scale').notNullable().defaultTo(1.0)
  })
}

export const down = async (knex) => {
  // battlemaps
  await knex.schema.alterTable('battlemaps', (table) => {
    table.dropColumn('voxel_scale')
  })

  // combat_roster — les CHECKs chk_state_position/chk_state_weapon sont
  // automatiquement supprimés par PostgreSQL lors du DROP COLUMN
  await knex.schema.alterTable('combat_roster', (table) => {
    table.dropColumn('state_position')
    table.dropColumn('state_weapon')
  })

  // combat_actions — idx_actions_token doit être supprimé explicitement
  // (il indexe campaign_id+token_id, aucun de ces colonnes n'est droppé)
  // idx_actions_key sera supprimé automatiquement avec DROP COLUMN action_key
  await knex.raw('DROP INDEX IF EXISTS idx_actions_token')
  await knex.schema.alterTable('combat_actions', (table) => {
    table.dropColumn('action_key')  // supprime aussi idx_actions_key
    table.dropColumn('sequence')
    table.dropColumn('target_pos_x')
    table.dropColumn('target_pos_y')
    table.dropColumn('target_pos_z')
  })
  // Restaurer les anciennes colonnes
  await knex.schema.alterTable('combat_actions', (table) => {
    table.boolean('is_micro').notNullable().defaultTo(false)
    table.integer('initiative_score').nullable()
    table.jsonb('target_pos').nullable()
  })
}
