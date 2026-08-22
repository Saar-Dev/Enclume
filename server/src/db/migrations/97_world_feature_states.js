// 97_world_feature_states.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."world_feature_states" (
    "battlemap_id" uuid not null,
    "feature_id" uuid not null,
    "state" jsonb not null default '{}'::jsonb,
    "version" integer not null default 1,
    "updated_by" uuid,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."world_feature_states" cascade;
  `)
}
