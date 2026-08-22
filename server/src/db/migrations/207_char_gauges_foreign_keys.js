// 207_char_gauges_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_gauges" add constraint "char_gauges_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_gauges" drop constraint if exists "char_gauges_char_sheet_id_foreign";
  `)
}
