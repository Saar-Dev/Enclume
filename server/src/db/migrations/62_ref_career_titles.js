// 62_ref_career_titles.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_career_titles" (
    "id" uuid not null default gen_random_uuid(),
    "career_id" uuid not null,
    "min_years" integer not null,
    "max_years" integer,
    "title" text not null,
    "salary_per_year" integer,
    "salary_formula" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_career_titles" cascade;
  `)
}
