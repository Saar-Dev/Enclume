// 66_ref_equipment_ammo_compat.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_equipment_ammo_compat" (
    "ammo_id" uuid not null,
    "weapon_id" uuid not null
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_equipment_ammo_compat" cascade;
  `)
}
