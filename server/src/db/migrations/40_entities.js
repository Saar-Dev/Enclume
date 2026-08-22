// 40_entities.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."entities" (
    "id" uuid not null default gen_random_uuid(),
    "battlemap_id" uuid not null,
    "blueprint_id" uuid not null,
    "pos_x" double precision not null,
    "pos_y" double precision not null,
    "pos_z" double precision not null,
    "r" integer not null default 0,
    "current_state_id" integer not null default 0,
    "gm_only" boolean not null default false,
    "label_override" text,
    "interaction_overrides" jsonb not null default '{}'::jsonb,
    "disabled_interactions" text[] not null default '{}'::text[],
    "state" jsonb not null default '{}'::jsonb,
    "notes_gm" text,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."entities" cascade;
  `)
}
