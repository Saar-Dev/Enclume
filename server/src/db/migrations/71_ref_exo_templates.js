// 71_ref_exo_templates.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_exo_templates" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "category" text not null,
    "environment" text not null,
    "depth_operational" integer,
    "depth_limit" integer,
    "depth_crush" integer,
    "base_exoforce" integer not null default 0,
    "base_speed_underwater" integer,
    "base_speed_surface" integer,
    "base_blindage" integer not null default 0,
    "malus_init_underwater" integer not null default 0,
    "malus_init_surface" integer not null default 0,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "underwater_movement_mode" text not null default 'vit'::text,
    "surface_movement_mode" text not null default 'vit'::text,
    "speeds_extra" jsonb not null default '[]'::jsonb,
    "manufacturer" text,
    "price" integer,
    "rarity" text,
    "tech_level" text,
    "autonomy" text,
    "illustration_url" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_exo_templates" cascade;
  `)
}
