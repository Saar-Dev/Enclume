// 356_combat_state_drone_turn_model_gm_player.js — docs/PLANS/PLAN_DRONE.md Sprint 2d
//
// Révision demandée par Saar en testant le Sprint 2d (2026-09-17) : `drone_turn_model` (migration 355,
// déjà appliquée — remplacée ici plutôt qu'éditée en place, .claude/rules/migrations.md « jamais de
// correction empilée sur une migration antérieure ») était UN SEUL réglage pour tous les drones d'un
// combat. Retour Saar : « j'aimerai différencier le mode de fonctionnement du MJ et des joueurs. MJ
// peut être en CLASSIQUE et joueur en ORDRES PERMANENTS par exemple. » Scindé en deux colonnes,
// discriminées par `characters.user_id` (déjà l'autorité existante pour « drone possédé par un
// joueur » — cf. `isOwner` dans socketCombatAnnouncement.js) : `_gm` s'applique à un drone sans
// propriétaire joueur (`user_id IS NULL`, style PNJ) ; `_player` à un drone assigné à un joueur.
//
// NOT NULL DEFAULT 'classique' sur les deux — même raisonnement que 355 : aucun changement silencieux
// pour un combat existant.

export const up = async (knex) => {
  await knex.raw('ALTER TABLE combat_state DROP CONSTRAINT IF EXISTS chk_combat_state_drone_turn_model')
  await knex.raw('ALTER TABLE combat_state DROP COLUMN IF EXISTS drone_turn_model')

  await knex.raw("ALTER TABLE combat_state ADD COLUMN IF NOT EXISTS drone_turn_model_gm text NOT NULL DEFAULT 'classique'")
  await knex.raw("ALTER TABLE combat_state ADD COLUMN IF NOT EXISTS drone_turn_model_player text NOT NULL DEFAULT 'classique'")
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_combat_state_drone_turn_model_gm') THEN
        ALTER TABLE combat_state ADD CONSTRAINT chk_combat_state_drone_turn_model_gm
          CHECK (drone_turn_model_gm IN ('classique', 'ordres_permanents'));
      END IF;
    END $$;
  `)
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_combat_state_drone_turn_model_player') THEN
        ALTER TABLE combat_state ADD CONSTRAINT chk_combat_state_drone_turn_model_player
          CHECK (drone_turn_model_player IN ('classique', 'ordres_permanents'));
      END IF;
    END $$;
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE combat_state DROP CONSTRAINT IF EXISTS chk_combat_state_drone_turn_model_gm')
  await knex.raw('ALTER TABLE combat_state DROP CONSTRAINT IF EXISTS chk_combat_state_drone_turn_model_player')
  await knex.raw('ALTER TABLE combat_state DROP COLUMN IF EXISTS drone_turn_model_gm')
  await knex.raw('ALTER TABLE combat_state DROP COLUMN IF EXISTS drone_turn_model_player')

  // Restaure la forme 355 (round-trip complet, symétrique de up())
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
