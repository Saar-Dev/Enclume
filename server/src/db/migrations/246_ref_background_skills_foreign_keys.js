// 246_ref_background_skills_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_background_skills" add constraint "ref_background_skills_background_id_foreign" FOREIGN KEY (background_id) REFERENCES ref_backgrounds(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_background_skills" drop constraint if exists "ref_background_skills_background_id_foreign";
  `)
}
