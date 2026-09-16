// 348_exo_computers_malfunction_severity.js — docs/PLANS/PLAN_INFORMATIQUE.md §4 Lot 2, §2.4/§3 point 5
//
// `exo_computers` n'avait aucune colonne `malfunction_severity`, contrairement à `char_inventory`
// (migration 330) — pourtant MANUEL_INFORMATIQUE.md §4.5 dit explicitement que l'IEM soumet la
// cible « à un Test de panne (même mécanique que tout Test de panne, MANUEL_USURE.md §4) » : si
// c'est la même mécanique, l'état de panne qui en fait partie (simple/critique, persistant jusqu'à
// réparation) en fait partie aussi. Ce n'était pas un choix d'architecture, déjà répondu par le
// MANUEL — cette colonne est un prérequis du Lot 2 (l'adaptateur `exo_computers` du Repository
// pattern de `runPanneTest` a besoin d'écrire un résultat de panne complet, pas seulement une
// perte d'ITG).
//
// Même forme que `char_inventory.malfunction_severity` (330) : colonne texte + CHECK
// simple/critical, additive pure, idempotente. Aucune contrainte de cohérence avec
// integrite_current/integrite_max : cette table n'en a déjà pas entre ces deux colonnes
// (139_exo_computers_constraints.js) — cohérence délibérée avec l'existant, pas un durcissement
// isolé sur la seule colonne neuve (même raisonnement que la migration 345, survie_iem).

export const up = async (knex) => {
  await knex.raw('ALTER TABLE exo_computers ADD COLUMN IF NOT EXISTS malfunction_severity text')
  await knex.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_exo_computers_malfunction_severity') THEN
        ALTER TABLE exo_computers ADD CONSTRAINT chk_exo_computers_malfunction_severity
          CHECK (malfunction_severity IS NULL OR malfunction_severity IN ('simple', 'critical'));
      END IF;
    END $$;
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE exo_computers DROP CONSTRAINT IF EXISTS chk_exo_computers_malfunction_severity')
  await knex.raw('ALTER TABLE exo_computers DROP COLUMN IF EXISTS malfunction_severity')
}
