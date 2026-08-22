// 251_ref_career_random_benefits_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_random_benefits" add constraint "ref_career_random_benefits_career_id_foreign" FOREIGN KEY (career_id) REFERENCES ref_careers(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_random_benefits" drop constraint if exists "ref_career_random_benefits_career_id_foreign";
  `)
}
