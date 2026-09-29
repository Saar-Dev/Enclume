// 378_ref_equipment_source_id.js — docs/PLANS/PLAN_SUPPLEMENTS.md §2.5 (Lot B)
//
// Étiquette chaque ligne du catalogue équipement avec sa source. Séquence expand/contract en un seul
// fichier (même patron que 372_ref_exo_templates_source_id.js) : colonne nullable → backfill → NOT
// NULL, une seule transaction Postgres.
//
// Backfill par clé naturelle (`name`), jamais par `id` (§6.5) : les 7 lignes de
// 347_ref_equipment_guidetech_programs_seed.js (family='Logiciels', category='specialise') sont
// authentiquement Guide Technique — vérifié unique en base le 2026-09-29 (0 collision de nom avec
// une autre famille) — et vont à 'guide_technique'. Toutes les autres lignes (LdB + tout le reste du
// catalogue, transcrit avant que ce mécanisme existe) vont à 'ldb'.
//
// UNIQUE(name, source_id) dans 379_ref_equipment_source_id_constraints.js.

const GUIDE_TECHNIQUE_PROGRAM_NAMES = ['Alerte', 'Bouclier', 'Darter', 'Masque', 'Phalanx', 'Recherche', 'SkyMarshall']

export const up = async (knex) => {
  await knex.raw('ALTER TABLE "public"."ref_equipment" ADD COLUMN IF NOT EXISTS "source_id" uuid')

  const ldb = await knex('ref_sources').where({ code: 'ldb' }).first()
  const guideTechnique = await knex('ref_sources').where({ code: 'guide_technique' }).first()
  if (!ldb) throw new Error('[378] ref_sources.code = \'ldb\' introuvable — migration 371 doit être appliquée avant celle-ci')
  if (!guideTechnique) throw new Error('[378] ref_sources.code = \'guide_technique\' introuvable — migration 377 doit être appliquée avant celle-ci')

  const gtUpdated = await knex('ref_equipment')
    .whereNull('source_id')
    .where({ family: 'Logiciels', category: 'specialise' })
    .whereIn('name', GUIDE_TECHNIQUE_PROGRAM_NAMES)
    .update({ source_id: guideTechnique.id })

  const ldbUpdated = await knex('ref_equipment').whereNull('source_id').update({ source_id: ldb.id })
  console.log(`[378] ref_equipment.source_id : ${gtUpdated} ligne(s) → guide_technique, ${ldbUpdated} ligne(s) → ldb`)

  await knex.raw('ALTER TABLE "public"."ref_equipment" ALTER COLUMN "source_id" SET NOT NULL')
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE "public"."ref_equipment" ALTER COLUMN "source_id" DROP NOT NULL')
  await knex.raw('ALTER TABLE "public"."ref_equipment" DROP COLUMN IF EXISTS "source_id"')
}
