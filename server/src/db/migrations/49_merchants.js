// 49_merchants.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."merchants" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "name" text not null,
    "status" text not null default 'CLOSED'::text,
    "mod_global" integer not null default 0,
    "nt_max" integer not null default 6,
    "niv_max" integer not null default 5,
    "gen_max" integer not null default 5,
    "dispo_min" integer,
    "rules" jsonb not null default '[]'::jsonb,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "allowed_char_ids" text[] not null default '{}'::text[]
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."merchants" cascade;
  `)
}
