// 217_char_skills_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_skills" add constraint "char_skills_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;

alter table "public"."char_skills" add constraint "char_skills_skill_id_foreign" FOREIGN KEY (skill_id) REFERENCES ref_skills(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_skills" drop constraint if exists "char_skills_skill_id_foreign";
alter table "public"."char_skills" drop constraint if exists "char_skills_char_sheet_id_foreign";
  `)
}
