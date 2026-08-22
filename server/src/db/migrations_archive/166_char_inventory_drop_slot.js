// Migration 166 — Retire char_inventory.slot (Lot C, docs/PLAN_INVENTORY_SLOTS.md).
// char_inventory_slots (migration 162) est désormais l'unique autorité — tous les lecteurs et
// écrivains (serveur + client) ont été basculés (Lot B) avant ce retrait. L'index existant sur la
// colonne (idx_char_inventory_slot, migration 50) est supprimé automatiquement par Postgres avec
// la colonne.
export const up = async (knex) => {
  await knex.schema.table('char_inventory', (table) => {
    table.dropColumn('slot')
  })
}

// Reconstruit la colonne et ses valeurs depuis char_inventory_slots (string_agg trié) — réversible
// tant que la nouvelle table (autorité réelle) existe encore.
export const down = async (knex) => {
  await knex.schema.table('char_inventory', (table) => {
    table.string('slot', 20).nullable()
  })
  await knex.raw(`
    UPDATE char_inventory ci
    SET slot = sub.slots
    FROM (
      SELECT char_inventory_id, string_agg(slot_code, '/' ORDER BY slot_code) AS slots
      FROM char_inventory_slots
      GROUP BY char_inventory_id
    ) sub
    WHERE sub.char_inventory_id = ci.id
  `)
  await knex.raw('CREATE INDEX idx_char_inventory_slot ON char_inventory(slot) WHERE slot IS NOT NULL')
}
