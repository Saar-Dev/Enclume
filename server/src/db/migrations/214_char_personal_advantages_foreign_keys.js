// 214_char_personal_advantages_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_personal_advantages" add constraint "char_personal_advantages_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_personal_advantages" drop constraint if exists "char_personal_advantages_char_sheet_id_foreign";
  `)
}
