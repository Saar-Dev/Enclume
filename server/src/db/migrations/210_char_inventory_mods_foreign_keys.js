// 210_char_inventory_mods_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_inventory_mods" add constraint "char_inventory_mods_equipment_id_foreign" FOREIGN KEY (equipment_id) REFERENCES ref_equipment(id) ON DELETE SET NULL;

alter table "public"."char_inventory_mods" add constraint "char_inventory_mods_weapon_inv_id_foreign" FOREIGN KEY (weapon_inv_id) REFERENCES char_inventory(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_inventory_mods" drop constraint if exists "char_inventory_mods_weapon_inv_id_foreign";
alter table "public"."char_inventory_mods" drop constraint if exists "char_inventory_mods_equipment_id_foreign";
  `)
}
