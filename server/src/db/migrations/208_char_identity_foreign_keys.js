// 208_char_identity_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_identity" add constraint "char_identity_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_identity" drop constraint if exists "char_identity_char_sheet_id_foreign";
  `)
}
