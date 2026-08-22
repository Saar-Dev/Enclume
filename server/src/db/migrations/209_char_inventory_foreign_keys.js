// 209_char_inventory_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_inventory" add constraint "char_inventory_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

alter table "public"."char_inventory" add constraint "char_inventory_current_ammo_foreign" FOREIGN KEY (current_ammo) REFERENCES ref_equipment(id) ON DELETE SET NULL;

alter table "public"."char_inventory" add constraint "char_inventory_equipment_id_foreign" FOREIGN KEY (equipment_id) REFERENCES ref_equipment(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_inventory" drop constraint if exists "char_inventory_equipment_id_foreign";
alter table "public"."char_inventory" drop constraint if exists "char_inventory_current_ammo_foreign";
alter table "public"."char_inventory" drop constraint if exists "char_inventory_character_id_foreign";
  `)
}
