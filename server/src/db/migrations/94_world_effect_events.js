// 94_world_effect_events.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."world_effect_events" (
    "id" uuid not null default gen_random_uuid(),
    "battlemap_id" uuid not null,
    "effect_instance_id" uuid,
    "token_id" uuid,
    "event_type" text not null,
    "payload" jsonb not null default '{}'::jsonb,
    "runtime_revision" integer not null,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."world_effect_events" cascade;
  `)
}
