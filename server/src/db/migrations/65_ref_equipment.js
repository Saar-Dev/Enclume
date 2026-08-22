// 65_ref_equipment.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_equipment" (
    "id" uuid not null default gen_random_uuid(),
    "family" text not null,
    "category" text not null,
    "name" text not null,
    "description" text,
    "price" integer,
    "price_modifier" character varying(50),
    "weight" real,
    "tech_level" integer,
    "manufacturer" character varying(50),
    "bonus" character varying(50),
    "max_level" integer,
    "nation" character varying(50),
    "damage_h" character varying(50),
    "damage_v_low" character varying(50),
    "damage_v_high" character varying(50),
    "shock" character varying(50),
    "range" character varying(50),
    "min_str" integer,
    "init_mod" integer,
    "fire_mode" character varying(20),
    "ammo_count" character varying(50),
    "ammo_cost" character varying(50),
    "caliber" character varying(50),
    "rarity" character varying(20) not null default '20(20)'::character varying,
    "linked_attr" text,
    "protection" integer,
    "protection_modifier" character varying(50),
    "protection_shock" integer,
    "location" character varying(50),
    "malus_cat" text,
    "capacity" real,
    "waterproof" boolean,
    "ammo_effects" text,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "generation" integer,
    "mod_slot" text,
    "mod_requires_aim" boolean not null default false,
    "shield_atk_malus" integer,
    "shield_extra_locations" text,
    "mod_key" text,
    "shock_mechanism" character varying(20),
    "shock_reduced_by_armor" boolean not null default true,
    "duration" character varying(50)
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_equipment" cascade;
  `)
}
