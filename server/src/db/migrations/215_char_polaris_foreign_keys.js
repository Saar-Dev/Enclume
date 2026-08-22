// 215_char_polaris_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_polaris" add constraint "char_polaris_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_polaris" drop constraint if exists "char_polaris_char_sheet_id_foreign";
  `)
}
