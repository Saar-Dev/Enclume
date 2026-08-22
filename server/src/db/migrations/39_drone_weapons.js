// 39_drone_weapons.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."drone_weapons" (
    "id" uuid not null default gen_random_uuid(),
    "character_id" uuid not null,
    "equipment_id" uuid,
    "contenance_chargeur" integer not null default 0,
    "ammo_restant" integer,
    "sort_order" smallint default '0'::smallint,
    "label_override" text,
    "name" text,
    "damage_formula" text,
    "portee" text,
    "fire_mode" text not null default 'rc'::text,
    "notes" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."drone_weapons" cascade;
  `)
}
