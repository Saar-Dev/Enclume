// 60_ref_career_random_benefits.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_career_random_benefits" (
    "id" uuid not null default gen_random_uuid(),
    "career_id" uuid not null,
    "roll" integer not null,
    "description" text not null,
    "points_alt" integer,
    "effects" jsonb not null default '[]'::jsonb
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_career_random_benefits" cascade;
  `)
}
