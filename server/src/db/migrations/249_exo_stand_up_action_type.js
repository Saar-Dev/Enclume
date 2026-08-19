// Migration 249 — Ajoute 'exo_stand_up' au CHECK constraint de combat_actions.type
// PLAN_EXOARMURE.md Lot 2bis §9.3 — Test de Manœuvre d'armure pour se relever depuis 'prone'
// (REGLEARMURE.md:381-395), résolu comme une entrée d'échelle à part entière (même famille que
// 'melee'/'assault', migration 63) plutôt qu'une action simple : jet visible en chat, issue
// probabiliste, jamais un coût déterministe comme move_short/reload.
export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE combat_actions
      DROP CONSTRAINT chk_action_type,
      ADD CONSTRAINT chk_action_type
        CHECK (type IN ('assault','move_short','move_long','micro','skip','reload','melee','exo_stand_up'))
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE combat_actions
      DROP CONSTRAINT chk_action_type,
      ADD CONSTRAINT chk_action_type
        CHECK (type IN ('assault','move_short','move_long','micro','skip','reload','melee'))
  `)
}
