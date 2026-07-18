// 172_combat_timeline_entries.js
// docs/PLAN_COMBAT_TIMELINE.md §5 — Lot A : modèle de données de l'échelle de phases.
//
// `combat_timeline_entries` porte l'ordre de résolution réel du Tour (une entrée = une action
// complexe déclarée — CaC/Tir), découplé de `combat_roster` qui garde uniquement l'identité/état par
// personnage. `combat_actions.turn_number` est ajouté en même temps (§6bis point 5) : `endTurn()` ne
// supprime plus les lignes (retrait du DELETE inconditionnel, PC28), la file "en cours" se filtre
// désormais par `turn_number` plutôt que par contenu total de la table — suppression réelle seulement
// à COMBAT_START d'un nouveau combat (COMBAT_END, inchangé, wipe déjà tout).

export const up = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.integer('turn_number').notNullable().defaultTo(1)
  })

  await knex.schema.createTable('combat_timeline_entries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('campaign_id').notNullable()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    table.integer('turn_number').notNullable()
    table.uuid('token_id').notNullable()
      .references('id').inTable('tokens').onDelete('CASCADE')
    table.uuid('combat_action_id').notNullable()
      .references('id').inTable('combat_actions').onDelete('CASCADE')
    table.uuid('declaration_group_id').nullable()
    table.integer('phase_position').nullable()
    table.text('status').notNullable().defaultTo('scheduled')
    table.timestamp('resolved_at', { useTz: true }).nullable()
    table.jsonb('resolution_snapshot').nullable()
    table.timestamps(true, true)
  })
  await knex.raw(`
    ALTER TABLE combat_timeline_entries ADD CONSTRAINT chk_timeline_entry_status
      CHECK (status IN ('delayed_waiting', 'scheduled', 'resolved', 'lost', 'skipped'))
  `)
  await knex.raw('CREATE INDEX idx_timeline_entries_turn ON combat_timeline_entries(campaign_id, turn_number, status)')
  await knex.raw('CREATE INDEX idx_timeline_entries_token ON combat_timeline_entries(campaign_id, token_id)')
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('combat_timeline_entries')
  await knex.schema.alterTable('combat_actions', (table) => {
    table.dropColumn('turn_number')
  })
}
