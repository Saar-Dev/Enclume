// 355_combat_state_drone_turn_model.js — docs/PLANS/PLAN_DRONE.md Sprint 2d
//
// Option de campagne `drone_turn_model` (classique/ordres_permanents, campaignSettingsService.js)
// figée sur `combat_state` à COMBAT_START, même patron que `action_timer_sec` — modifiable entre deux
// combats, jamais en cours de combat (retour Saar 2026-09-17).
//
// NOT NULL DEFAULT 'classique' : tout combat démarré avant ce Sprint (et toute campagne sans réglage
// explicite) se comporte exactement comme avant, zéro changement silencieux.

export const up = async (knex) => {
  await knex.raw("ALTER TABLE combat_state ADD COLUMN IF NOT EXISTS drone_turn_model text NOT NULL DEFAULT 'classique'")
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_combat_state_drone_turn_model') THEN
        ALTER TABLE combat_state ADD CONSTRAINT chk_combat_state_drone_turn_model
          CHECK (drone_turn_model IN ('classique', 'ordres_permanents'));
      END IF;
    END $$;
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE combat_state DROP CONSTRAINT IF EXISTS chk_combat_state_drone_turn_model')
  await knex.raw('ALTER TABLE combat_state DROP COLUMN IF EXISTS drone_turn_model')
}
