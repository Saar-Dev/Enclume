// 78_ref_setbacks.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_setbacks" (
    "id" uuid not null default gen_random_uuid(),
    "description" text not null,
    "roll_min" integer not null,
    "roll_max" integer not null,
    "name" text not null,
    "effects" jsonb not null default '[]'::jsonb
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_setbacks" cascade;
  `)
}
