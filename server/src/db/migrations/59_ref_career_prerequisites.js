// 59_ref_career_prerequisites.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_career_prerequisites" (
    "id" uuid not null default gen_random_uuid(),
    "career_id" uuid not null,
    "prerequisite_career_id" uuid,
    "min_years" integer not null,
    "prerequisite_logic" text default 'AND'::text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_career_prerequisites" cascade;
  `)
}
