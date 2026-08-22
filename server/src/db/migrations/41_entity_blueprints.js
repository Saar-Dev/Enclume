// 41_entity_blueprints.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."entity_blueprints" (
    "id" uuid not null default gen_random_uuid(),
    "created_by" uuid,
    "label" text not null,
    "glb_url" text,
    "geometry" jsonb not null default '{}'::jsonb,
    "states" jsonb not null default '[]'::jsonb,
    "interactions" jsonb not null default '[]'::jsonb,
    "deprecated" boolean not null default false,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "pack_id" uuid,
    "builtin_key" text,
    "category" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."entity_blueprints" cascade;
  `)
}
