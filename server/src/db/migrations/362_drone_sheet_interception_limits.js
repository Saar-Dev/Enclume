// 362_drone_sheet_interception_limits.js — docs/PLANS/PLAN_DRONE_INTERCEPTION.md §5 (Lot 3, CRD)
//
// Deux champs EXPLICITES de la fiche drone (jamais une détection par le nom ou la charge utile du drone) :
//  - interception_max_simultaneous : plafond d'interceptions simultanées (dans le même Tour). RAW : le CRD
//    Neptune/Artémis « ne peut contrer plus de 4 attaques simultanément », −1 au Test par interception
//    supplémentaire. NULL = drone bouclier personnel : aucune règle de simultanéité, ni plafond ni malus.
//  - interception_leash_m : rayon d'action en mètres autour du protégé. RAW : les mini-drones « ne peuvent
//    s'éloigner de plus de 10 mètres de l'armure ». NULL = aucune limite (bouclier personnel).
// Nullables, sans défaut : aucun changement pour un drone existant. `double precision` (le driver renvoie un
// nombre, pas une chaîne comme pour `numeric`). Bornes reprises par shared/droneInterception.js
// (parseInterceptionLimit) côté route.

export const up = async (knex) => {
  await knex.raw('ALTER TABLE drone_sheet ADD COLUMN IF NOT EXISTS interception_max_simultaneous smallint')
  await knex.raw('ALTER TABLE drone_sheet ADD COLUMN IF NOT EXISTS interception_leash_m double precision')
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_drone_sheet_interception_max_simultaneous') THEN
        ALTER TABLE drone_sheet ADD CONSTRAINT chk_drone_sheet_interception_max_simultaneous
          CHECK (interception_max_simultaneous IS NULL OR interception_max_simultaneous >= 1);
      END IF;
    END $$;
  `)
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_drone_sheet_interception_leash_m') THEN
        ALTER TABLE drone_sheet ADD CONSTRAINT chk_drone_sheet_interception_leash_m
          CHECK (interception_leash_m IS NULL OR interception_leash_m > 0);
      END IF;
    END $$;
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE drone_sheet DROP CONSTRAINT IF EXISTS chk_drone_sheet_interception_leash_m')
  await knex.raw('ALTER TABLE drone_sheet DROP CONSTRAINT IF EXISTS chk_drone_sheet_interception_max_simultaneous')
  await knex.raw('ALTER TABLE drone_sheet DROP COLUMN IF EXISTS interception_leash_m')
  await knex.raw('ALTER TABLE drone_sheet DROP COLUMN IF EXISTS interception_max_simultaneous')
}
