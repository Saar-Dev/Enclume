// 202_char_advantage_notes_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_advantage_notes" add constraint "char_advantage_notes_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_advantage_notes" drop constraint if exists "char_advantage_notes_char_sheet_id_foreign";
  `)
}
