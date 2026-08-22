// 22_char_sheet.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_sheet" (
    "id" uuid not null default gen_random_uuid(),
    "character_id" uuid not null,
    "chc" integer default 11,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "xp_total" integer not null default 0,
    "xp_available" integer not null default 0,
    "sols" integer not null default 0,
    "creation_state" text,
    "wizard_locked_at" timestamp with time zone,
    "celebrity" integer not null default 0,
    "fatigue_points" integer not null default 0,
    "wizard_progress" jsonb not null default '{}'::jsonb
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_sheet" cascade;
  `)
}
