// 31_combat_pending.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."combat_pending" (
    "campaign_id" uuid not null,
    "token_id" uuid not null,
    "type" text not null,
    "payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "id" uuid not null default gen_random_uuid()
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."combat_pending" cascade;
  `)
}
