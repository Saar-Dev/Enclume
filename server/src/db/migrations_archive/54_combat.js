export const up = async (knex) => {
  // combat_state — 1 ligne max par campagne, PK = campaign_id (contrainte SQL forte)
  await knex.schema.createTable('combat_state', (table) => {
    table.uuid('campaign_id').primary()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('battlemap_id').nullable()
      .references('id').inTable('battlemaps').onDelete('SET NULL')
    table.text('phase').notNullable()
    table.integer('current_turn').notNullable().defaultTo(1)
    table.integer('active_slot_idx').notNullable().defaultTo(0)
    table.integer('action_timer_sec').notNullable().defaultTo(0) // 0 = infini (PC17)
    table.timestamps(true, true)
  })
  await knex.raw(`
    ALTER TABLE combat_state ADD CONSTRAINT chk_combat_phase
      CHECK (phase IN ('ROSTER','ANNOUNCEMENT','RESOLUTION'))
  `)

  // combat_roster — un participant par token, initiative figée au COMBAT_START
  await knex.schema.createTable('combat_roster', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('campaign_id').notNullable()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('token_id').notNullable()
      .references('id').inTable('tokens').onDelete('CASCADE')
    table.boolean('is_surprised').notNullable().defaultTo(false)
    table.integer('surprise_roll').nullable() // visible GM uniquement (PC25)
    table.integer('base_ini').notNullable().defaultTo(0) // REA calculé au COMBAT_START, figé
    table.integer('initiative').notNullable().defaultTo(0) // base_ini ± modificateurs
    table.text('status').notNullable().defaultTo('active')
    table.boolean('has_announced').notNullable().defaultTo(false)
    table.boolean('has_resolved').notNullable().defaultTo(false)
    table.timestamps(true, true)
  })
  await knex.raw(`
    ALTER TABLE combat_roster
      ADD CONSTRAINT chk_roster_status CHECK (status IN ('active','done')),
      ADD CONSTRAINT uq_roster_campaign_token UNIQUE (campaign_id, token_id)
  `)
  await knex.raw('CREATE INDEX idx_roster_campaign ON combat_roster(campaign_id)')

  // combat_actions — actions déclarées par tour, vidées à chaque fin de tour (PC28)
  await knex.schema.createTable('combat_actions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('campaign_id').notNullable()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('token_id').notNullable()
      .references('id').inTable('tokens').onDelete('CASCADE')
    table.text('type').notNullable()
    table.boolean('is_micro').notNullable().defaultTo(false)
    table.integer('initiative_score').nullable()
    table.uuid('target_token_id').nullable()
      .references('id').inTable('tokens').onDelete('SET NULL')
    table.jsonb('target_pos').nullable()
    table.uuid('weapon_inv_id').nullable()
      .references('id').inTable('char_inventory').onDelete('SET NULL')
    table.jsonb('modifiers').nullable()
    table.text('status').notNullable().defaultTo('pending')
    table.timestamps(true, true)
  })
  await knex.raw(`
    ALTER TABLE combat_actions
      ADD CONSTRAINT chk_action_type
        CHECK (type IN ('assault','move_short','move_long','micro','skip')),
      ADD CONSTRAINT chk_action_status
        CHECK (status IN ('pending','resolved','skipped'))
  `)
  await knex.raw('CREATE INDEX idx_actions_campaign ON combat_actions(campaign_id)')
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('combat_actions')
  await knex.schema.dropTableIfExists('combat_roster')
  await knex.schema.dropTableIfExists('combat_state')
}
