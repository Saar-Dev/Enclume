// 218_char_traits_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_traits" add constraint "char_traits_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_traits" drop constraint if exists "char_traits_char_sheet_id_foreign";
  `)
}
