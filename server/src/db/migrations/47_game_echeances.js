// 47_game_echeances.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."game_echeances" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "character_id" uuid not null,
    "condition_type" text not null,
    "interactive" boolean not null,
    "payload" jsonb not null default '{}'::jsonb,
    "next_due_minutes" integer not null,
    "interval_minutes" integer,
    "occurrences_remaining" integer,
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."game_echeances" cascade;
  `)
}
