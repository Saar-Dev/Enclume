// 58_ref_career_point_categories.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_career_point_categories" (
    "id" uuid not null default gen_random_uuid(),
    "career_id" uuid not null,
    "sort_order" integer not null,
    "category" text not null
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_career_point_categories" cascade;
  `)
}
