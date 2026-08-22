// 257_ref_exo_template_computers_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_exo_template_computers" add constraint "ref_exo_template_computers_template_id_foreign" FOREIGN KEY (template_id) REFERENCES ref_exo_templates(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_exo_template_computers" drop constraint if exists "ref_exo_template_computers_template_id_foreign";
  `)
}
