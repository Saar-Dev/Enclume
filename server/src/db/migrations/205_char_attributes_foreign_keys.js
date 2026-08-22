// 205_char_attributes_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_attributes" add constraint "char_attributes_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_attributes" drop constraint if exists "char_attributes_char_sheet_id_foreign";
  `)
}
