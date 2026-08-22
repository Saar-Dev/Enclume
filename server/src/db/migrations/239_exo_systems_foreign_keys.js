// 239_exo_systems_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."exo_systems" add constraint "exo_systems_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

alter table "public"."exo_systems" add constraint "exo_systems_ref_equipment_id_foreign" FOREIGN KEY (ref_equipment_id) REFERENCES ref_equipment(id) ON DELETE RESTRICT;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."exo_systems" drop constraint if exists "exo_systems_ref_equipment_id_foreign";
alter table "public"."exo_systems" drop constraint if exists "exo_systems_character_id_foreign";
  `)
}
