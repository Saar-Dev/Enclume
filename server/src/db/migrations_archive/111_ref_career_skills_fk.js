// 111_ref_career_skills_fk.js
// Ajoute une vraie contrainte FK ref_career_skills.skill_id -> ref_skills.id (PIÈGE 1 corrigé
// pour cette table) et supprime skill_group (texte libre redondant, jamais aligné avec
// ref_skills.family — source du bug de fragmentation UI trouvé au lot 2/3).
// Voir docs/PLAN_CAREER_SKILLS_FK.md pour le détail complet.
// Vérifié avant écriture : 0 ligne orpheline sur les 208 lignes actuelles (lots 1+2).

export const up = async (knex) => {
  await knex.schema.alterTable('ref_career_skills', (table) => {
    table.foreign('skill_id').references('id').inTable('ref_skills').onDelete('RESTRICT')
  })
  await knex.schema.alterTable('ref_career_skills', (table) => {
    table.dropColumn('skill_group')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('ref_career_skills', (table) => {
    table.text('skill_group')
  })
  await knex.schema.alterTable('ref_career_skills', (table) => {
    table.dropForeign('skill_id')
  })
}
