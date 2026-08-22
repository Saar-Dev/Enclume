// 256_ref_equipment_skills_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_equipment_skills" add constraint "ref_equipment_skills_item_id_foreign" FOREIGN KEY (item_id) REFERENCES ref_equipment(id) ON DELETE CASCADE;

alter table "public"."ref_equipment_skills" add constraint "ref_equipment_skills_skill_id_foreign" FOREIGN KEY (skill_id) REFERENCES ref_skills(id) ON DELETE RESTRICT;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_equipment_skills" drop constraint if exists "ref_equipment_skills_skill_id_foreign";
alter table "public"."ref_equipment_skills" drop constraint if exists "ref_equipment_skills_item_id_foreign";
  `)
}
