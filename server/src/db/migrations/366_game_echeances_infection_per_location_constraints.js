// 366_game_echeances_infection_per_location_constraints.js — au plus UNE infection vivante par personnage et par localisation (Lot B1 de docs/PLANS/PLAN_GUERISON_RAW.md).
//
// Le livre joue l'infection « pour chaque Localisation » (REGLEBLESSURES.md:439-442) : un seul Test de Constitution par localisation. `ensureLocationInfection`
// (woundHealingSchedule.js) fusionne au lieu de créer un doublon ; cet index est le garde-fou de la BASE : deux lots simultanés qui créeraient la même infection
// ne peuvent pas tous deux réussir (le perdant échoue dans son savepoint, l'entrée est annulée, le MJ recommence et la fusion s'applique).
// Partiel : seules les échéances VIVANTES comptent — une infection terminée ou annulée n'empêche jamais d'en créer une nouvelle.
//
// Suit 365 (qui a converti les infections vivantes et fusionné les doublons) : sans elle, l'index échouerait sur des doublons hérités.
// Idempotent (IF NOT EXISTS / IF EXISTS).

export const up = async (knex) => {
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_game_echeances_infection_per_location
    ON game_echeances (character_id, (payload->>'location'))
    WHERE condition_type = 'wound_infection_check'
      AND status IN ('active', 'pending_mj_review', 'awaiting_player_roll')
  `)
}

export const down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS uq_game_echeances_infection_per_location')
}
