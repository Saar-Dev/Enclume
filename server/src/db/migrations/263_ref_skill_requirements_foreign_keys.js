// 263_ref_skill_requirements_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_skill_requirements" add constraint "ref_skill_requirements_skill_id_foreign" FOREIGN KEY (skill_id) REFERENCES ref_skills(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_skill_requirements" drop constraint if exists "ref_skill_requirements_skill_id_foreign";
  `)
}
