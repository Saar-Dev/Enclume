// 372_ref_exo_templates_source_id.js — docs/PLANS/PLAN_SUPPLEMENTS.md §2.2 (Lot A)
//
// Étiquette chaque modèle du catalogue avec sa source de contenu. Séquence expand/contract en un
// seul fichier (comme 364_ref_equipment_grenade_weight.js pour l'ajout+backfill, étendu ici d'un
// `SET NOT NULL` puisque, contrairement à ce précédent, toute ligne DOIT avoir une source) :
// colonne nullable → backfill → NOT NULL, dans une seule transaction Postgres (DDL transactionnelle),
// donc jamais d'état intermédiaire visible.
//
// Backfill vers 'ldb' pour les 15 lignes actuelles : confirmé par comparaison exhaustive de leur
// Exo-Force avec docs/REGLES/SEEDEXO.md (15/15 correspondances exactes, aucune ne correspond au
// Guide Technique — docs/PLANS/PLAN_SUPPLEMENTS.md, en-tête). Lookup par `code` (clé métier de
// ref_sources), jamais un `id` recopié en dur (§6.5).
//
// UNIQUE(name, source_id) dans 373_ref_exo_templates_source_id_constraints.js.

export const up = async (knex) => {
  await knex.raw('ALTER TABLE "public"."ref_exo_templates" ADD COLUMN IF NOT EXISTS "source_id" uuid')

  const ldb = await knex('ref_sources').where({ code: 'ldb' }).first()
  if (!ldb) throw new Error('[372] ref_sources.code = \'ldb\' introuvable — migration 371 doit être appliquée avant celle-ci')

  const updated = await knex('ref_exo_templates').whereNull('source_id').update({ source_id: ldb.id })
  console.log(`[372] ref_exo_templates.source_id : ${updated} ligne(s) rattachée(s) à 'ldb'`)

  await knex.raw('ALTER TABLE "public"."ref_exo_templates" ALTER COLUMN "source_id" SET NOT NULL')
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE "public"."ref_exo_templates" ALTER COLUMN "source_id" DROP NOT NULL')
  await knex.raw('ALTER TABLE "public"."ref_exo_templates" DROP COLUMN IF EXISTS "source_id"')
}
