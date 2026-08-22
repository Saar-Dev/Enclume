// 255_ref_equipment_skill_assoc_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_equipment_skill_assoc" add constraint "ref_equipment_skill_assoc_item_id_foreign" FOREIGN KEY (item_id) REFERENCES ref_equipment(id) ON DELETE CASCADE;

alter table "public"."ref_equipment_skill_assoc" add constraint "ref_equipment_skill_assoc_skill_id_foreign" FOREIGN KEY (skill_id) REFERENCES ref_skills(id) ON DELETE RESTRICT;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_equipment_skill_assoc" drop constraint if exists "ref_equipment_skill_assoc_skill_id_foreign";
alter table "public"."ref_equipment_skill_assoc" drop constraint if exists "ref_equipment_skill_assoc_item_id_foreign";
  `)
}
