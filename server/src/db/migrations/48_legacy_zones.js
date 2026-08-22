// 48_legacy_zones.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."legacy_zones" (
    "id" uuid not null default gen_random_uuid(),
    "battlemap_id" uuid not null,
    "level" text not null,
    "points" jsonb not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."legacy_zones" cascade;
  `)
}
