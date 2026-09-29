// 377_ref_sources_guide_technique_seed.js — docs/PLANS/PLAN_SUPPLEMENTS.md §2.5 (Lot B)
//
// Ajoute la source « Guide Technique » — nécessaire dès ce Lot B, pas seulement pour de futures
// fiches d'exo-armures GT : `347_ref_equipment_guidetech_programs_seed.js` a déjà inséré 7 lignes
// authentiquement Guide Technique dans ref_equipment (Alerte, Bouclier, Darter, Masque, Phalanx,
// Recherche, SkyMarshall), avant que ce mécanisme existe. Le backfill de la migration suivante
// (378) les rattache à cette source plutôt qu'à 'ldb'.
//
// `id` généré par Postgres, jamais codé en dur (§6.5). Idempotent par clé métier (`code`).

export const up = async (knex) => {
  const existing = await knex('ref_sources').where({ code: 'guide_technique' }).first()
  if (existing) return

  await knex('ref_sources').insert({
    code: 'guide_technique',
    name: 'Guide Technique',
    description: 'Contenu du supplément Guide Technique — actif par campagne, jamais fusionné silencieusement avec le Livre de Base.',
    is_core: false,
  })
}

export const down = async (knex) => {
  await knex('ref_sources').where({ code: 'guide_technique' }).delete()
}
