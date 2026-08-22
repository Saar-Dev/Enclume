// occurred_at_game_minutes = repère mécanique (campaigns.game_time_resolved_minutes) capturé à
// l'insertion de la case, jamais campaigns.game_time_minutes (affiché) — voir
// docs/PLAN_BLESSURES_GUERISON.md §4 (correction 2026-07-30, analyse à charge combinée avec
// PLAN_FATIGUE_DOMMAGES.md) : ancrer sur l'affiché exposerait une blessure toute neuve, créée après
// un recul d'horloge MJ, à un déclenchement immédiat de sa Guérison/Infection. created_at (existant,
// temps réel) reste la seule trace narrative de quand la blessure a eu lieu.
export const up = async (knex) => {
  await knex.schema.alterTable('character_wounds', (table) => {
    table.integer('occurred_at_game_minutes').notNullable().defaultTo(0)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('character_wounds', (table) => {
    table.dropColumn('occurred_at_game_minutes')
  })
}
