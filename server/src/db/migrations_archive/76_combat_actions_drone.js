/**
 * Migration 76 — Arme drone dans combat_actions
 *
 * Ajoute drone_weapon_inv_id FK → drone_weapons.
 * Contrainte XOR : weapon_inv_id (humanoïdes) et drone_weapon_inv_id ne peuvent pas
 * être simultanément non-null sur la même ligne.
 */

export const up = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.uuid('drone_weapon_inv_id').nullable().references('id').inTable('drone_weapons').onDelete('SET NULL')
  })
  await knex.raw(`
    ALTER TABLE combat_actions
      ADD CONSTRAINT chk_weapon_xor
        CHECK (weapon_inv_id IS NULL OR drone_weapon_inv_id IS NULL)
  `)
}

export const down = async (knex) => {
  await knex.raw(`ALTER TABLE combat_actions DROP CONSTRAINT IF EXISTS chk_weapon_xor`)
  await knex.schema.alterTable('combat_actions', (table) => {
    table.dropColumn('drone_weapon_inv_id')
  })
}
