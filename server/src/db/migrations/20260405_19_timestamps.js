/**
 * Migration 19 — Timestamps manquants
 *
 * Ajoute uniquement les colonnes absentes après vérification de toutes les migrations.
 *
 * Déjà présents — NE PAS TOUCHER :
 *   users            — created_at + updated_at (migration 01, table.timestamps)
 *   campaigns        — created_at + updated_at (migration 02, table.timestamps)
 *   campaign_members — created_at + updated_at (migration 03, table.timestamps)
 *   battlemaps       — created_at + updated_at (migration 04, table.timestamps)
 *   documents        — created_at + updated_at (migration 06, table.timestamps)
 *   dice_rolls       — created_at + updated_at (migration 06, table.timestamps)
 *   walls            — created_at (migration 10)
 *   zones            — created_at (migration 10)
 *   player_locations — updated_at (migration 10)
 *   characters       — created_at (migration 15)
 *
 * À ajouter :
 *   tokens           — created_at + updated_at (migration 05 n'en avait pas)
 *   characters       — updated_at seulement
 *   walls            — updated_at seulement
 *   zones            — updated_at seulement
 *   player_locations — created_at seulement
 */

export const up = async (knex) => {
  // ── tokens — aucun timestamp en migration 05 ─────────────────────────────────
  await knex.schema.alterTable('tokens', (table) => {
    table.timestamp('created_at').defaultTo(knex.fn.now()).nullable()
    table.timestamp('updated_at').defaultTo(knex.fn.now()).nullable()
  })

  // ── characters — created_at présent (migration 15), updated_at manquant ──────
  await knex.schema.alterTable('characters', (table) => {
    table.timestamp('updated_at').defaultTo(knex.fn.now()).nullable()
  })

  // ── walls — created_at présent (migration 10), updated_at manquant ───────────
  await knex.schema.alterTable('walls', (table) => {
    table.timestamp('updated_at').defaultTo(knex.fn.now()).nullable()
  })

  // ── zones — created_at présent (migration 10), updated_at manquant ───────────
  await knex.schema.alterTable('zones', (table) => {
    table.timestamp('updated_at').defaultTo(knex.fn.now()).nullable()
  })

  // ── player_locations — updated_at présent (migration 10), created_at manquant
  await knex.schema.alterTable('player_locations', (table) => {
    table.timestamp('created_at').defaultTo(knex.fn.now()).nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('player_locations', (table) => {
    table.dropColumn('created_at')
  })

  await knex.schema.alterTable('zones', (table) => {
    table.dropColumn('updated_at')
  })

  await knex.schema.alterTable('walls', (table) => {
    table.dropColumn('updated_at')
  })

  await knex.schema.alterTable('characters', (table) => {
    table.dropColumn('updated_at')
  })

  await knex.schema.alterTable('tokens', (table) => {
    table.dropColumn('updated_at')
    table.dropColumn('created_at')
  })
}
