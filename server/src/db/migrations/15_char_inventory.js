// 15_char_inventory.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_inventory" (
    "id" uuid not null default gen_random_uuid(),
    "character_id" uuid not null,
    "equipment_id" uuid,
    "container" character varying(20) not null default 'Coffre'::character varying,
    "quantity" integer not null default 1,
    "custom_name" character varying(255),
    "custom_desc" text,
    "notes" text,
    "custom_props" jsonb,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "current_ammo" uuid,
    "ammo_remaining" integer,
    "validated_by_gm" boolean not null default false
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_inventory" cascade;
  `)
}
