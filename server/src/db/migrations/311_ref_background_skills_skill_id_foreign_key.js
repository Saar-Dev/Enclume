// 311_ref_background_skills_skill_id_foreign_key.js
// CAR2 (docs/EN_COURS.md) — ref_background_skills.skill_id n'avait aucune FK vers ref_skills.id,
// même défaut préventif que ref_career_skills avant sa migration 252 (même patron repris ici :
// ON DELETE RESTRICT, jamais CASCADE — supprimer une compétence ne doit pas effacer silencieusement
// des associations background, ça doit être bloqué). Aucune ligne orpheline trouvée (vérifié avant
// d'écrire cette migration), aucun nettoyage de données nécessaire.
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_background_skills" add constraint "ref_background_skills_skill_id_foreign" FOREIGN KEY (skill_id) REFERENCES ref_skills(id) ON DELETE RESTRICT;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_background_skills" drop constraint if exists "ref_background_skills_skill_id_foreign";
  `)
}
