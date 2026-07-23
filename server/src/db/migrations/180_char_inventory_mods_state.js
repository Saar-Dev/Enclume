// Migration 180 — char_inventory_mods.state (docs/PLAN_MODDING_REFONTE.md Phase 1, Étape 1.4)
//
// Socle pour les mods à état persistant (Groupe 4 — ATI notamment, cumulativeMR par round). Colonne
// nullable, sans défaut, rétrocompatible : aucun mod existant (Groupe 1/2) n'utilise ce champ.
// Remise à NULL à COMBAT_END (Phase 3.4) — un state de combat ne survit jamais hors combat.
export const up = async (knex) => {
  await knex.schema.alterTable('char_inventory_mods', (table) => {
    table.jsonb('state').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_inventory_mods', (table) => {
    table.dropColumn('state')
  })
}
