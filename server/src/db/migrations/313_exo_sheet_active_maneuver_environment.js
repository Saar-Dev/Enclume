// 313_exo_sheet_active_maneuver_environment.js — PLAN_EXOARMURE.md §16.2.5
//
// Armures hybrides (exo_sheet.environment='hybrid') : RAW ("le personnage doit développer la
// Compétence qui correspond à chaque milieu", PLAN_EXOARMURE.md §7.2) rend le choix de spécialité
// Manœuvre d'armure réellement ambigu — rien dans le moteur monde n'expose "où est le pilote
// maintenant" (même lacune EAU1 que getExoMovementBudget/movementBudgetService.js). En attendant une
// détection temps réel (chantier séparé, hors périmètre), le pilote/MJ choisit manuellement.
//
// Colonne nullable : NULL rend le Test de Manœuvre d'armure impossible pour une armure hybride
// (resolveManeuverSkillId lève, capturé par resolveExoTestContext -> null, "Test impossible" — aucun
// repli automatique, décision Saar 2026-08-23, §16.2.5 du plan : "pas de fallback, c'est vraiment
// spécifique à chaque exo-armure"). Nullable uniquement parce qu'aucune armure hybride existante n'a
// encore ce choix posé, pas parce qu'une valeur absente reste utilisable. Domaine restreint aux
// 4 spécialités RAW réelles (pas 'hybrid'/'industrial', qui n'ont pas de sens comme choix ici — mêmes
// valeurs que EXO_MANEUVER_SKILL_BY_ENVIRONMENT, combatantContextService.js).

const VALUES = ['submarine', 'surface', 'atmospheric', 'spatial']

export const up = async (knex) => {
  await knex.schema.alterTable('exo_sheet', (t) => {
    t.text('active_maneuver_environment')
  })
  await knex.raw(`
    ALTER TABLE exo_sheet
      ADD CONSTRAINT chk_exo_sheet_active_maneuver_environment
      CHECK (active_maneuver_environment IS NULL OR active_maneuver_environment IN (${VALUES.map(v => `'${v}'`).join(', ')}))
  `)
}

export const down = async (knex) => {
  await knex.raw(`ALTER TABLE exo_sheet DROP CONSTRAINT IF EXISTS chk_exo_sheet_active_maneuver_environment`)
  await knex.schema.alterTable('exo_sheet', (t) => {
    t.dropColumn('active_maneuver_environment')
  })
}
