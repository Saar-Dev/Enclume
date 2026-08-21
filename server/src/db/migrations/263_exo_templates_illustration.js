/**
 * Migration 263 — illustration sur ref_exo_templates (PLAN_EXOARMURE.md §15)
 *
 * Trouvaille de Saar en clôturant la session de transcription RAW : aucune des 16 lignes
 * `ref_exo_templates` n'a de champ image. Patron repris de `characters.portrait_url` (upload MinIO à
 * l'exécution via un bouton, PLAN_EXOARMURE.md §15.1) plutôt que `ref_careers.illustration` (chemin
 * statique commité, migration 93/259) : les 16 armures existent déjà en base (migrations 252/253),
 * aucune image n'existe encore dans le dépôt, et Saar veut le même mécanisme d'upload que les
 * personnages, pas un asset figé.
 *
 * Nullable sans backfill : les 16 lignes existantes restent sans illustration jusqu'au premier upload
 * admin (route POST /api/exo-templates/:id/illustration, exoTemplates.js).
 *
 * Portée volontairement limitée à `ref_exo_templates` — contrairement aux stats mécaniques (EXF,
 * Blindage...) copiées sur `exo_sheet` par la migration 254 pour éviter un JOIN live à chaque calcul,
 * l'illustration n'est jamais calculée ni consommée par une règle de jeu : aucune raison de dupliquer
 * cette colonne sur `exo_sheet`, l'affichage en fiche (hors périmètre ici, pas encore codé) pourra
 * toujours passer par `template_id` sans risque d'incohérence (autorité unique, CLAUDE.md §1.4).
 */

export const up = async (knex) => {
  await knex.schema.alterTable('ref_exo_templates', (t) => {
    t.text('illustration_url')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('ref_exo_templates', (t) => {
    t.dropColumn('illustration_url')
  })
}
