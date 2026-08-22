// 56_ref_career_education.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_career_education" (
    "id" uuid not null default gen_random_uuid(),
    "career_id" uuid not null,
    "field" text not null
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_career_education" cascade;
  `)
}
