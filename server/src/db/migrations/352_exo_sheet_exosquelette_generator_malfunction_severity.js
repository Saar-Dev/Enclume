// 352_exo_sheet_exosquelette_generator_malfunction_severity.js — PLAN_INFORMATIQUE.md §4 Lot 2bis
//
// Complète 350/351 pour les 2 dernières catégories de l'Attaque IEM (REGLEARMURE.md:434-441) :
// Exosquelette et Générateur. Ces deux-là n'ont pas de table dédiée — leur Intégrité vit déjà
// directement sur `exo_sheet` (`itg_exosquelette_current`/`_max`, `itg_generator_current`/`_max`,
// migration 44), jamais consommée par un mécanisme de Test de panne. Décision Saar 2026-09-16 :
// même symétrie RAW que Systèmes auxiliaires/Armement (« soumis à un Test de panne », uniforme pour
// les 4 catégories) → état de panne persistant nécessaire ici aussi, pas seulement une perte d'ITG.
//
// Nom des colonnes sans préfixe `itg_` (contrairement à leurs colonnes d'Intégrité sœurs) : elles
// ne portent pas une valeur d'Intégrité mais un état de panne, même famille que
// `char_inventory.malfunction_severity` — le préfixe `itg_` de ce fichier ne qualifie que les
// colonnes numériques de la table (structure/exosquelette/générateur), pas introduit ici pour deux
// colonnes texte isolées. Prérequis de `EXO_EXOSQUELETTE_ADAPTER`/`EXO_GENERATOR_ADAPTER`
// (integrityService.js), adressés par `character_id` (pas de ligne dédiée, `exo_sheet` est une table
// 1 ligne par exo-armure).
//
// Même forme que 330/348/350/351 : colonnes texte + CHECK simple/critical, additive pure,
// idempotente, une contrainte par colonne (pas de contrainte croisée avec les itg_* correspondantes
// — cohérence avec l'absence de contrainte équivalente ailleurs dans ce chantier).

export const up = async (knex) => {
  await knex.raw('ALTER TABLE exo_sheet ADD COLUMN IF NOT EXISTS exosquelette_malfunction_severity text')
  await knex.raw('ALTER TABLE exo_sheet ADD COLUMN IF NOT EXISTS generator_malfunction_severity text')
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_exo_sheet_exosquelette_malfunction_severity') THEN
        ALTER TABLE exo_sheet ADD CONSTRAINT chk_exo_sheet_exosquelette_malfunction_severity
          CHECK (exosquelette_malfunction_severity IS NULL OR exosquelette_malfunction_severity IN ('simple', 'critical'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_exo_sheet_generator_malfunction_severity') THEN
        ALTER TABLE exo_sheet ADD CONSTRAINT chk_exo_sheet_generator_malfunction_severity
          CHECK (generator_malfunction_severity IS NULL OR generator_malfunction_severity IN ('simple', 'critical'));
      END IF;
    END $$;
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE exo_sheet DROP CONSTRAINT IF EXISTS chk_exo_sheet_exosquelette_malfunction_severity')
  await knex.raw('ALTER TABLE exo_sheet DROP CONSTRAINT IF EXISTS chk_exo_sheet_generator_malfunction_severity')
  await knex.raw('ALTER TABLE exo_sheet DROP COLUMN IF EXISTS exosquelette_malfunction_severity')
  await knex.raw('ALTER TABLE exo_sheet DROP COLUMN IF EXISTS generator_malfunction_severity')
}
