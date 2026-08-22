// 237_exo_programs_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."exo_programs" add constraint "exo_programs_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

alter table "public"."exo_programs" add constraint "exo_programs_equipment_id_foreign" FOREIGN KEY (equipment_id) REFERENCES ref_equipment(id) ON DELETE RESTRICT;

alter table "public"."exo_programs" add constraint "exo_programs_exo_computer_id_foreign" FOREIGN KEY (exo_computer_id) REFERENCES exo_computers(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."exo_programs" drop constraint if exists "exo_programs_exo_computer_id_foreign";
alter table "public"."exo_programs" drop constraint if exists "exo_programs_equipment_id_foreign";
alter table "public"."exo_programs" drop constraint if exists "exo_programs_character_id_foreign";
  `)
}
