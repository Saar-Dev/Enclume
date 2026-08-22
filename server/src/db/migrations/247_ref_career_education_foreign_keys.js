// 247_ref_career_education_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_education" add constraint "ref_career_education_career_id_foreign" FOREIGN KEY (career_id) REFERENCES ref_careers(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_education" drop constraint if exists "ref_career_education_career_id_foreign";
  `)
}
