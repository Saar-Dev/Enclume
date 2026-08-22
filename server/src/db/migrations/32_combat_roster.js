// 32_combat_roster.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."combat_roster" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "token_id" uuid not null,
    "is_surprised" boolean not null default false,
    "surprise_roll" integer,
    "base_ini" integer not null default 0,
    "initiative" integer not null default 0,
    "status" text not null default 'active'::text,
    "has_announced" boolean not null default false,
    "has_resolved" boolean not null default false,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "state_position" text not null default 'standing'::text,
    "state_weapon" text not null default 'holstered'::text,
    "state_character" jsonb not null default '{}'::jsonb,
    "state_cover" text not null default 'exposed'::text,
    "state_fire_mode" text not null default 'cc'::text,
    "state_vitesse" text not null default 'normal'::text,
    "state_combat_mode" text not null default 'normal'::text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."combat_roster" cascade;
  `)
}
