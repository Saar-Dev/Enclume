// 231_drone_programs_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."drone_programs" add constraint "drone_programs_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

alter table "public"."drone_programs" add constraint "drone_programs_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES ref_equipment(id) ON DELETE RESTRICT;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."drone_programs" drop constraint if exists "drone_programs_equipment_id_fkey";
alter table "public"."drone_programs" drop constraint if exists "drone_programs_character_id_foreign";
  `)
}
