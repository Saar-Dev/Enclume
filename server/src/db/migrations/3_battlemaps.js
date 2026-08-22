// 3_battlemaps.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."battlemaps" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "name" text not null,
    "image_url" text,
    "grid_size" integer default 50,
    "grid_enabled" boolean default true,
    "viewport_state" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "scale_label" text not null default '1,5m'::text,
    "grid_opacity" real not null default '0.5'::real,
    "voxel_data" jsonb,
    "editor_locked_by" uuid,
    "editor_locked_until" timestamp with time zone,
    "voxel_scale" real not null default '1'::real,
    "surface_data" jsonb not null default '{}'::jsonb,
    "world_revision" integer not null default 0,
    "surface_revision" integer not null default 0,
    "voxel_revision" integer not null default 0,
    "runtime_revision" integer not null default 0,
    "render_mode" text not null default '3d'::text,
    "grid_offset_x" integer not null default 0,
    "grid_offset_y" integer not null default 0,
    "folder_id" uuid
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."battlemaps" cascade;
  `)
}
