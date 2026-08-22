// 134_combat_actions_aim_bonus_comp.js
// Tir visé (LdB p.227-228) — bonus au Test de tir pour tranches d'Initiative sacrifiées (docs/PLAN_TIRVISE.md).
// Miroir exact de fire_mode_bonus_comp (57_combat_v3.js) — colonne réelle, jamais JSONB modifiers
// (voir dual_wield_bonus_comp, jamais relu en résolution, bug pré-existant hors scope).

export const up = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.smallint('aim_bonus_comp').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.dropColumn('aim_bonus_comp')
  })
}
