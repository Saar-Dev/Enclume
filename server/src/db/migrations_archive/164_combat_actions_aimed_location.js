// 164_combat_actions_aimed_location.js
// Viser une Localisation précise (LdB p.229-230, docs/BUGIDENTIFIE.md COM9) — zone choisie à la
// déclaration (docs/PLAN_TIRVISE v2.md), relue en résolution pour forcer le slot dans
// damageService.resolveTargetHit au lieu du 1D20 aléatoire. Miroir de aim_bonus_comp (134) : colonne
// réelle, jamais JSONB modifiers. Pas de CHECK (même convention que combat_actions.fire_mode,
// 57_combat_v3.js) — validation applicative contre shared/armorConstants.js AIMED_LOCATION_MALUS.

export const up = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.text('aimed_location').nullable()
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('combat_actions', (table) => {
    table.dropColumn('aimed_location')
  })
}
