// 44_exo_sheet.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."exo_sheet" (
    "character_id" uuid not null,
    "template_id" uuid,
    "pilot_character_id" uuid,
    "itg_structure_max" integer not null default 20,
    "itg_structure_current" integer not null default 20,
    "itg_exosquelette_max" integer not null default 20,
    "itg_exosquelette_current" integer not null default 20,
    "itg_generator_max" integer not null default 20,
    "itg_generator_current" integer not null default 20,
    "avaries_legeres" integer not null default 0,
    "avaries_moyennes" integer not null default 0,
    "avaries_graves" integer not null default 0,
    "avaries_critiques" integer not null default 0,
    "avaries_catastrophiques" integer not null default 0,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "category" text,
    "environment" text,
    "depth_operational" integer,
    "depth_limit" integer,
    "depth_crush" integer,
    "base_exoforce" integer,
    "base_blindage" integer,
    "base_speed_underwater" integer,
    "base_speed_surface" integer,
    "underwater_movement_mode" text,
    "surface_movement_mode" text,
    "speeds_extra" jsonb,
    "malus_init_underwater" integer,
    "malus_init_surface" integer,
    "manufacturer" text,
    "price" integer,
    "rarity" text,
    "tech_level" text,
    "autonomy" text,
    "taille" text,
    "type_batterie" text,
    "type_coque" text,
    "notes" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."exo_sheet" cascade;
  `)
}
