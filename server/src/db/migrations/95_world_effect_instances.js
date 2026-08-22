// 95_world_effect_instances.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."world_effect_instances" (
    "id" uuid not null default gen_random_uuid(),
    "battlemap_id" uuid not null,
    "definition_key" text not null,
    "target_kind" text not null,
    "target_id" text,
    "volume" jsonb,
    "intensity" numeric(10,4) not null default '1'::numeric,
    "duration_rounds" integer,
    "state" text not null default 'active'::text,
    "source" jsonb not null default '{}'::jsonb,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."world_effect_instances" cascade;
  `)
}
