// 250_ref_career_prerequisites_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_prerequisites" add constraint "ref_career_prerequisites_career_id_foreign" FOREIGN KEY (career_id) REFERENCES ref_careers(id) ON DELETE CASCADE;

alter table "public"."ref_career_prerequisites" add constraint "ref_career_prerequisites_prerequisite_career_id_foreign" FOREIGN KEY (prerequisite_career_id) REFERENCES ref_careers(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_prerequisites" drop constraint if exists "ref_career_prerequisites_prerequisite_career_id_foreign";
alter table "public"."ref_career_prerequisites" drop constraint if exists "ref_career_prerequisites_career_id_foreign";
  `)
}
