// 351_exo_weapons_malfunction_severity.js — docs/PLANS/PLAN_INFORMATIQUE.md §4 Lot 2bis
//
// Même besoin que 350 (`exo_systems`), pour la catégorie « Armement » de l'Attaque IEM
// (REGLEARMURE.md:434-441) — sauf les équipements sans composants électroniques, filtré au niveau
// applicatif (runIemPanneTrigger), pas ici. `exo_weapons` a déjà `integrite_current`/`integrite_max`
// (migration 45), jamais consommés par un mécanisme de Test de panne à ce jour. Prérequis de
// `EXO_WEAPON_ADAPTER` (integrityService.js).
//
// Même forme que 330/348/350 : colonne texte + CHECK simple/critical, additive pure, idempotente.

export const up = async (knex) => {
  await knex.raw('ALTER TABLE exo_weapons ADD COLUMN IF NOT EXISTS malfunction_severity text')
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_exo_weapons_malfunction_severity') THEN
        ALTER TABLE exo_weapons ADD CONSTRAINT chk_exo_weapons_malfunction_severity
          CHECK (malfunction_severity IS NULL OR malfunction_severity IN ('simple', 'critical'));
      END IF;
    END $$;
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE exo_weapons DROP CONSTRAINT IF EXISTS chk_exo_weapons_malfunction_severity')
  await knex.raw('ALTER TABLE exo_weapons DROP COLUMN IF EXISTS malfunction_severity')
}
