/**
 * Migration 154 — état runtime durable des features et effets environnementaux.
 *
 * L'ancienne table `zones` n'avait aucun consommateur actif et ne portait ni définition, ni
 * intensité, ni hooks. Elle est archivée sans conversion approximative sous `legacy_zones`.
 */

export const up = async (knex) => {
  if (await knex.schema.hasTable('zones')) {
    if (await knex.schema.hasTable('legacy_zones')) await knex.schema.dropTable('legacy_zones')
    await knex.schema.renameTable('zones', 'legacy_zones')
  }

  await knex.schema.createTable('world_effect_definitions', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE')
    table.text('effect_key').notNullable()
    table.text('label').notNullable()
    table.text('icon').nullable()
    table.text('note').nullable()
    table.text('category').notNullable()
    table.text('stacking').notNullable().defaultTo('max')
    table.jsonb('modifiers').notNullable().defaultTo('{}')
    table.jsonb('hooks').notNullable().defaultTo('[]')
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.timestamps(true, true)
    table.unique(['campaign_id', 'effect_key'])
  })

  await knex.schema.createTable('world_feature_states', table => {
    table.uuid('battlemap_id').notNullable().references('id').inTable('battlemaps').onDelete('CASCADE')
    table.uuid('feature_id').notNullable()
    table.jsonb('state').notNullable().defaultTo('{}')
    table.integer('version').notNullable().defaultTo(1)
    table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.timestamps(true, true)
    table.primary(['battlemap_id', 'feature_id'])
  })

  await knex.schema.createTable('world_effect_instances', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('battlemap_id').notNullable().references('id').inTable('battlemaps').onDelete('CASCADE')
    table.text('definition_key').notNullable()
    table.text('target_kind').notNullable()
    table.text('target_id').nullable()
    table.jsonb('volume').nullable()
    table.decimal('intensity', 10, 4).notNullable().defaultTo(1)
    table.integer('duration_rounds').nullable()
    table.text('state').notNullable().defaultTo('active')
    table.jsonb('source').notNullable().defaultTo('{}')
    table.jsonb('metadata').notNullable().defaultTo('{}')
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.timestamps(true, true)
    table.index(['battlemap_id', 'state'])
    table.index(['battlemap_id', 'target_kind', 'target_id'])
  })

  await knex.schema.createTable('world_effect_events', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('battlemap_id').notNullable().references('id').inTable('battlemaps').onDelete('CASCADE')
    table.uuid('effect_instance_id').nullable().references('id').inTable('world_effect_instances').onDelete('SET NULL')
    table.uuid('token_id').nullable().references('id').inTable('tokens').onDelete('SET NULL')
    table.text('event_type').notNullable()
    table.jsonb('payload').notNullable().defaultTo('{}')
    table.integer('runtime_revision').notNullable()
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.index(['battlemap_id', 'created_at'])
  })

  await knex.raw(`
    ALTER TABLE world_effect_definitions
      ADD CONSTRAINT chk_world_effect_stacking CHECK (stacking IN ('max', 'multiply'));
    ALTER TABLE world_effect_instances
      ADD CONSTRAINT chk_world_effect_target_kind
        CHECK (target_kind IN ('volume', 'support', 'feature', 'compartment', 'entity', 'token')),
      ADD CONSTRAINT chk_world_effect_state CHECK (state IN ('active', 'paused', 'expired')),
      ADD CONSTRAINT chk_world_effect_intensity CHECK (intensity > 0 AND intensity <= 100),
      ADD CONSTRAINT chk_world_effect_target
        CHECK ((target_kind = 'volume' AND volume IS NOT NULL) OR (target_kind <> 'volume' AND target_id IS NOT NULL));
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('world_effect_events')
  await knex.schema.dropTableIfExists('world_effect_instances')
  await knex.schema.dropTableIfExists('world_feature_states')
  await knex.schema.dropTableIfExists('world_effect_definitions')
  if (await knex.schema.hasTable('legacy_zones')) {
    if (await knex.schema.hasTable('zones')) await knex.schema.dropTable('zones')
    await knex.schema.renameTable('legacy_zones', 'zones')
  }
}
