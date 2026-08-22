// 233_drone_weapons_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."drone_weapons" add constraint "drone_weapons_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

alter table "public"."drone_weapons" add constraint "drone_weapons_equipment_id_foreign" FOREIGN KEY (equipment_id) REFERENCES ref_equipment(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."drone_weapons" drop constraint if exists "drone_weapons_equipment_id_foreign";
alter table "public"."drone_weapons" drop constraint if exists "drone_weapons_character_id_foreign";
  `)
}
