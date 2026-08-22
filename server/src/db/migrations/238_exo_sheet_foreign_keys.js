// 238_exo_sheet_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."exo_sheet" add constraint "exo_sheet_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

alter table "public"."exo_sheet" add constraint "exo_sheet_pilot_character_id_foreign" FOREIGN KEY (pilot_character_id) REFERENCES characters(id) ON DELETE SET NULL;

alter table "public"."exo_sheet" add constraint "exo_sheet_template_id_foreign" FOREIGN KEY (template_id) REFERENCES ref_exo_templates(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."exo_sheet" drop constraint if exists "exo_sheet_template_id_foreign";
alter table "public"."exo_sheet" drop constraint if exists "exo_sheet_pilot_character_id_foreign";
alter table "public"."exo_sheet" drop constraint if exists "exo_sheet_character_id_foreign";
  `)
}
