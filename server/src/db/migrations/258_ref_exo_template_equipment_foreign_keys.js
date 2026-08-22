// 258_ref_exo_template_equipment_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_exo_template_equipment" add constraint "ref_exo_template_equipment_ref_equipment_id_foreign" FOREIGN KEY (ref_equipment_id) REFERENCES ref_equipment(id) ON DELETE RESTRICT;

alter table "public"."ref_exo_template_equipment" add constraint "ref_exo_template_equipment_template_id_foreign" FOREIGN KEY (template_id) REFERENCES ref_exo_templates(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_exo_template_equipment" drop constraint if exists "ref_exo_template_equipment_template_id_foreign";
alter table "public"."ref_exo_template_equipment" drop constraint if exists "ref_exo_template_equipment_ref_equipment_id_foreign";
  `)
}
