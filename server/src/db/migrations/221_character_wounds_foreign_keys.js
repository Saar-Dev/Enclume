// 221_character_wounds_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."character_wounds" add constraint "character_wounds_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."character_wounds" drop constraint if exists "character_wounds_char_sheet_id_foreign";
  `)
}
