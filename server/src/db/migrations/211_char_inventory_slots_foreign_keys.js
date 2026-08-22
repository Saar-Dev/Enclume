// 211_char_inventory_slots_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_inventory_slots" add constraint "char_inventory_slots_char_inventory_id_foreign" FOREIGN KEY (char_inventory_id) REFERENCES char_inventory(id) ON DELETE CASCADE;

alter table "public"."char_inventory_slots" add constraint "char_inventory_slots_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_inventory_slots" drop constraint if exists "char_inventory_slots_character_id_foreign";
alter table "public"."char_inventory_slots" drop constraint if exists "char_inventory_slots_char_inventory_id_foreign";
  `)
}
