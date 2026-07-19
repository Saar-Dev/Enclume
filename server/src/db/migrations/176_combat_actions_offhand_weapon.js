// COM29 — Tir à deux armes : seule la main directrice était trackée (munitions). Ajoute la colonne
// symétrique à weapon_inv_id (54_combat.js) pour la main non directrice — même FK, même politique
// ON DELETE. CHECK miroir du patron XOR déjà utilisé pour drone_weapon_inv_id (76_combat_actions_drone.js) :
// une main non directrice n'a de sens que si une main directrice existe.
export const up = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.uuid('offhand_weapon_inv_id').nullable()
      .references('id').inTable('char_inventory').onDelete('SET NULL')
  })
  await knex.raw(`
    ALTER TABLE combat_actions
      ADD CONSTRAINT chk_offhand_requires_primary
        CHECK (offhand_weapon_inv_id IS NULL OR weapon_inv_id IS NOT NULL)
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE combat_actions DROP CONSTRAINT IF EXISTS chk_offhand_requires_primary')
  await knex.schema.alterTable('combat_actions', (table) => {
    table.dropColumn('offhand_weapon_inv_id')
  })
}
