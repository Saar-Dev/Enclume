// 371_ref_sources_seed.js — seed ref_sources : le Livre de Base (369).
//
// `id` généré par Postgres, jamais codé en dur (contrairement à 307_ref_exo_templates_seed.js, dont
// le hardcodage d'UUID est un anti-pattern reconnu et volontairement non reproduit ici,
// docs/PLANS/PLAN_SUPPLEMENTS.md §6.5). Idempotent par clé métier (`code`) : ne réinsère pas si la
// ligne existe déjà (nodemon peut rejouer `up()` après un redémarrage sans dupliquer).

export const up = async (knex) => {
  const existing = await knex('ref_sources').where({ code: 'ldb' }).first()
  if (existing) return

  await knex('ref_sources').insert({
    code: 'ldb',
    name: 'Livre de Base',
    description: 'Contenu de base du Livre de Base Polaris — toujours actif, non désactivable.',
    is_core: true,
  })
}

export const down = async (knex) => {
  await knex('ref_sources').where({ code: 'ldb' }).delete()
}
