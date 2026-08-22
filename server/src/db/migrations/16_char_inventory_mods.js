// 16_char_inventory_mods.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_inventory_mods" (
    "id" uuid not null default gen_random_uuid(),
    "weapon_inv_id" uuid not null,
    "equipment_id" uuid,
    "mod_name" text not null,
    "installed_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "mod_slot" text,
    "state" jsonb
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_inventory_mods" cascade;
  `)
}
