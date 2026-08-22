/**
 * Migration 133 — backfill char_sheet.wizard_locked_at (fiches antérieures au système Wizard)
 *
 * Migration 119 (Session 139) a ajouté wizard_locked_at nullable pour gater l'affichage personnage
 * (routes/characters.js, whereNotExists sur wizard_locked_at NULL) sans jamais backfiller les
 * lignes déjà existantes — anti-pattern "expand sans backfill" (cf. littérature migrations
 * zero-downtime : expand → backfill → contract, l'étape backfill a été sautée). Conséquence
 * vérifiée en base : 78/84 fiches de toute la base étaient invisibles en sidebar, y compris des
 * personnages pleinement joués (Deep, Soleil, Mr sourire, BaBar...).
 *
 * Cette migration s'exécute APRÈS la 132 (dédoublonnage) — un seul character_id par ligne
 * concernée, aucune ambiguïté sur laquelle backfiller.
 *
 * Critère de backfill dérivé du code, pas deviné :
 *  - creation_state IS NULL      → antérieur au système de suivi Wizard lui-même (introduit après
 *    ces lignes) : ne peut structurellement pas être un "brouillon en cours" au sens de la
 *    migration 119, ce concept n'existait pas encore pour elles.
 *  - creation_state = 'complete' → Wizard terminé (reconcileCreation), simplement jamais verrouillé
 *    à cause d'un bug d'atomicité désormais corrigé (voir reconcileCreation/lockWizard,
 *    creationService.js) — backfill légitime.
 *  - creation_state = 'draft_step0' (ou autre) → vrai brouillon en cours, jamais touché.
 *
 * down() : re-NULL les lignes correspondant au même critère — correct pour un round-trip de test
 * immédiat (P52/P54), pas garanti pour un rollback tardif en production après usage réel (ne peut
 * pas distinguer après coup un wizard_locked_at backfillé d'un wizard_locked_at posé normalement
 * depuis).
 */

export const up = async (knex) => {
  await knex('char_sheet')
    .whereNull('wizard_locked_at')
    .andWhere((qb) => {
      qb.whereNull('creation_state').orWhere('creation_state', 'complete')
    })
    .update({ wizard_locked_at: knex.raw('COALESCE(updated_at, created_at, now())') })
}

export const down = async (knex) => {
  await knex('char_sheet')
    .whereNotNull('wizard_locked_at')
    .andWhere((qb) => {
      qb.whereNull('creation_state').orWhere('creation_state', 'complete')
    })
    .update({ wizard_locked_at: null })
}
