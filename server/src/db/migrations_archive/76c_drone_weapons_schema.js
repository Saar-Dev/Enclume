/**
 * Migration 76c — Schéma armes drone (Sprint 2c)
 *
 * Ajoute les colonnes nécessaires à l'identification et la résolution
 * des attaques drones : nom, formule de dommages, portée, mode de tir.
 * equipment_id reste nullable (armes custom sans ref_equipment).
 */

export const up = async (knex) => {
  await knex.schema.alterTable('drone_weapons', (table) => {
    table.text('name').nullable()
    table.text('damage_formula').nullable()
    table.text('portee').nullable()
    table.text('fire_mode').notNullable().defaultTo('rc')
    table.text('notes').nullable()
  })

  // Contrainte CHECK fire_mode
  await knex.raw(`
    ALTER TABLE drone_weapons
      ADD CONSTRAINT chk_drone_weapons_fire_mode
        CHECK (fire_mode IN ('cc', 'rc', 'rl'))
  `)

  // equipment_id passe de NOT NULL à nullable (Option A — armes custom)
  await knex.raw(`
    ALTER TABLE drone_weapons
      ALTER COLUMN equipment_id DROP NOT NULL
  `)
}

export const down = async (knex) => {
  await knex.raw(`ALTER TABLE drone_weapons DROP CONSTRAINT IF EXISTS chk_drone_weapons_fire_mode`)
  await knex.raw(`ALTER TABLE drone_weapons ALTER COLUMN equipment_id SET NOT NULL`)
  await knex.schema.alterTable('drone_weapons', (table) => {
    table.dropColumn('name')
    table.dropColumn('damage_formula')
    table.dropColumn('portee')
    table.dropColumn('fire_mode')
    table.dropColumn('notes')
  })
}
