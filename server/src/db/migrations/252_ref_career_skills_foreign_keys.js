// 252_ref_career_skills_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_skills" add constraint "ref_career_skills_career_id_foreign" FOREIGN KEY (career_id) REFERENCES ref_careers(id) ON DELETE CASCADE;

alter table "public"."ref_career_skills" add constraint "ref_career_skills_skill_id_foreign" FOREIGN KEY (skill_id) REFERENCES ref_skills(id) ON DELETE RESTRICT;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_skills" drop constraint if exists "ref_career_skills_skill_id_foreign";
alter table "public"."ref_career_skills" drop constraint if exists "ref_career_skills_career_id_foreign";
  `)
}
