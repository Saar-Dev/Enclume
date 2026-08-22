// 93_world_effect_definitions.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."world_effect_definitions" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "effect_key" text not null,
    "label" text not null,
    "icon" text,
    "note" text,
    "category" text not null,
    "stacking" text not null default 'max'::text,
    "modifiers" jsonb not null default '{}'::jsonb,
    "hooks" jsonb not null default '[]'::jsonb,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."world_effect_definitions" cascade;
  `)
}
