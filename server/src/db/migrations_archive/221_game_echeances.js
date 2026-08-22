// game_echeances — table du moteur générique d'échéances de jeu (Lot 2,
// docs/PLAN_FATIGUE_DOMMAGES.md §8). payload reste opaque au moteur : seuls les identifiants y
// vivent (ex. { woundId }), jamais une donnée métier dupliquée depuis la table domaine du
// consommateur — celle-ci ne duplique jamais en retour next_due_minutes/interval_minutes/
// occurrences_remaining/status, qui restent l'autorité unique de planification (convention 2026-07-30,
// voir §8 du plan). interactive est dénormalisé depuis shared/echeanceTypeRegistry.js à la création
// de chaque ligne (source de vérité toujours le registre) — filtre direct de balayage pour que
// sweepDueEcheances/previewDueEcheances n'aient jamais à recharger le registre par ligne.
export const up = async (knex) => {
  await knex.schema.createTable('game_echeances', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('campaign_id').notNullable()
      .references('id').inTable('campaigns').onDelete('CASCADE')
    table.uuid('character_id').notNullable()
      .references('id').inTable('characters').onDelete('CASCADE')
    table.text('condition_type').notNullable()
    table.boolean('interactive').notNullable()
    table.jsonb('payload').notNullable().defaultTo('{}')
    table.integer('next_due_minutes').notNullable()
    table.integer('interval_minutes').nullable()
    table.integer('occurrences_remaining').nullable()
    table.text('status').notNullable().defaultTo('active')
    table.timestamps(true, true)
  })

  await knex.raw(`
    ALTER TABLE game_echeances
      ADD CONSTRAINT chk_echeances_status
        CHECK (status IN ('active','completed','cancelled','error','pending_mj_review','awaiting_player_roll'))
  `)

  await knex.raw(
    'CREATE INDEX idx_echeances_campaign_id ON game_echeances(campaign_id)'
  )
}

export const down = async (knex) => {
  await knex.schema.dropTable('game_echeances')
}
