// 7_campaigns.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."campaigns" (
    "id" uuid not null default gen_random_uuid(),
    "gm_id" uuid not null,
    "name" text not null,
    "invite_code" text not null,
    "status" text default 'active'::text,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "cover_image_url" text,
    "default_battlemap_id" uuid,
    "dice_config" jsonb,
    "cover_url" text,
    "default_token_glb_url" text,
    "settings" jsonb not null default '{}'::jsonb,
    "game_time_minutes" integer not null default 0,
    "game_time_resolved_minutes" integer not null default 0,
    "pending_advance_delta_minutes" integer,
    "pending_advance_undo_log" jsonb,
    "default_token_glb_url_drone" text,
    "default_token_glb_url_exo" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."campaigns" cascade;
  `)
}
