// 383_ref_equipment_illustration_url.js — demande Saar (2026-10-08), chantier UX Marchand
//
// Réservation de schéma pour une illustration par objet du catalogue : décision explicite de Saar
// de poser la colonne maintenant (nullable, pas de backfill, aucune valeur à ce jour) plutôt que
// d'attendre le chantier d'assets complet (sourcer/téléverser une image par ligne de ref_equipment,
// des centaines de lignes) — même patron déjà en place pour ref_exo_templates.illustration_url
// (migration 71) et exo_sheet.illustration_url (migration 376), restées à NULL depuis leur création
// faute de contenu, sans que cela n'ait jamais bloqué leur lecture côté client (`item.illustration_url &&`).
// Hors scope ici : UI d'upload, affichage réel dans le Marchand/catalogue — viendra avec le contenu.

export const up = async (knex) => {
  await knex.raw('ALTER TABLE "public"."ref_equipment" ADD COLUMN IF NOT EXISTS "illustration_url" text')
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE "public"."ref_equipment" DROP COLUMN IF EXISTS "illustration_url"')
}
