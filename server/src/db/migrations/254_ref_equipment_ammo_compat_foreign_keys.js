// 254_ref_equipment_ammo_compat_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_equipment_ammo_compat" add constraint "ref_equipment_ammo_compat_ammo_id_foreign" FOREIGN KEY (ammo_id) REFERENCES ref_equipment(id) ON DELETE CASCADE;

alter table "public"."ref_equipment_ammo_compat" add constraint "ref_equipment_ammo_compat_weapon_id_foreign" FOREIGN KEY (weapon_id) REFERENCES ref_equipment(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_equipment_ammo_compat" drop constraint if exists "ref_equipment_ammo_compat_weapon_id_foreign";
alter table "public"."ref_equipment_ammo_compat" drop constraint if exists "ref_equipment_ammo_compat_ammo_id_foreign";
  `)
}
