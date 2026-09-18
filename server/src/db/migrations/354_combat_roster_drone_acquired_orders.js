// 354_combat_roster_drone_acquired_orders.js — docs/PLANS/PLAN_DRONE.md Sprint 2d (mode `ordres_permanents`)
//
// Ordres permanents d'un drone autonome (LdB p.320) : cible + arme mémorisées, réutilisées Tour après
// Tour tant que le joueur/MJ ne les change pas via COMBAT_DRONE_SET_ORDERS. Les deux colonnes vivent
// ensemble sur `combat_roster` (persistantes entre les Tours d'UN combat, jamais entre deux combats —
// `combat_roster` est recréé à chaque COMBAT_START, décision assumée, docs/PLANS/PLAN_DRONE.md §4).
// `ON DELETE SET NULL` sur les deux : la cible peut mourir/quitter la carte, l'arme peut être
// désinstallée en cours de combat — dans les deux cas le drone doit simplement redevenir "sans ordre",
// jamais une contrainte qui bloquerait la suppression du token/de l'arme.
//
// IF NOT EXISTS / DO-block guardé (même forme que 350-353) : idempotent, sûr à rejouer sans avoir
// d'abord vérifié `knex_migrations` (tests directs up()/down() avant tout `migrate.latest()` réel,
// .claude/rules/migrations.md).

export const up = async (knex) => {
  await knex.raw('ALTER TABLE combat_roster ADD COLUMN IF NOT EXISTS acquired_target_token_id uuid')
  await knex.raw('ALTER TABLE combat_roster ADD COLUMN IF NOT EXISTS acquired_drone_weapon_inv_id uuid')
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'combat_roster_acquired_target_token_id_foreign') THEN
        ALTER TABLE combat_roster ADD CONSTRAINT combat_roster_acquired_target_token_id_foreign
          FOREIGN KEY (acquired_target_token_id) REFERENCES tokens(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `)
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'combat_roster_acquired_drone_weapon_inv_id_foreign') THEN
        ALTER TABLE combat_roster ADD CONSTRAINT combat_roster_acquired_drone_weapon_inv_id_foreign
          FOREIGN KEY (acquired_drone_weapon_inv_id) REFERENCES drone_weapons(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE combat_roster DROP COLUMN IF EXISTS acquired_target_token_id')
  await knex.raw('ALTER TABLE combat_roster DROP COLUMN IF EXISTS acquired_drone_weapon_inv_id')
}
