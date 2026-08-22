// 91_walls.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."walls" (
    "id" uuid not null default gen_random_uuid(),
    "battlemap_id" uuid not null,
    "x1" real not null,
    "y1" real not null,
    "x2" real not null,
    "y2" real not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."walls" cascade;
  `)
}
