// 350_exo_systems_malfunction_severity.js — docs/PLANS/PLAN_INFORMATIQUE.md §4 Lot 2bis
//
// Attaque IEM sur exo-armure (REGLEARMURE.md:434-441) : les 4 catégories touchées (Exosquelette,
// Générateur, Systèmes auxiliaires, Armement) sont TOUTES « soumises à un Test de panne » — même
// mécanique que le Test de panne standard (MANUEL_INFORMATIQUE.md §4.5), donc même besoin d'un état
// de panne persistant jusqu'à réparation. `exo_systems` a déjà `integrite_current`/`integrite_max`
// (migration 45) mais aucun mécanisme n'écrit dedans à ce jour (`exoAvarieService.js` ne touche que
// `exo_sheet.itg_structure_current`) — ce prérequis manquait pour brancher l'adaptateur Repository
// du Lot 2bis (`EXO_SYSTEM_ADAPTER`, integrityService.js).
//
// Même forme que `char_inventory`/`exo_computers` (330/348) : colonne texte + CHECK simple/critical,
// additive pure, idempotente. Aucune contrainte de cohérence avec integrite_current/integrite_max :
// cette table n'en a déjà pas entre ces deux colonnes (migration 45) — cohérence délibérée avec
// l'existant, pas un durcissement isolé sur la seule colonne neuve (même raisonnement que 345/348).

export const up = async (knex) => {
  await knex.raw('ALTER TABLE exo_systems ADD COLUMN IF NOT EXISTS malfunction_severity text')
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_exo_systems_malfunction_severity') THEN
        ALTER TABLE exo_systems ADD CONSTRAINT chk_exo_systems_malfunction_severity
          CHECK (malfunction_severity IS NULL OR malfunction_severity IN ('simple', 'critical'));
      END IF;
    END $$;
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE exo_systems DROP CONSTRAINT IF EXISTS chk_exo_systems_malfunction_severity')
  await knex.raw('ALTER TABLE exo_systems DROP COLUMN IF EXISTS malfunction_severity')
}
