// 27_character_wounds.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."character_wounds" (
    "id" uuid not null default gen_random_uuid(),
    "char_sheet_id" uuid not null,
    "location" text not null,
    "severity" text not null,
    "is_stabilized" boolean not null default false,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "occurred_at_game_minutes" integer not null default 0
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."character_wounds" cascade;
  `)
}
