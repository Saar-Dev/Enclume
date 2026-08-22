// 216_char_sheet_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_sheet" add constraint "char_sheet_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_sheet" drop constraint if exists "char_sheet_character_id_foreign";
  `)
}
