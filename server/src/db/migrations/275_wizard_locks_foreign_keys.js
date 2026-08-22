// 275_wizard_locks_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."wizard_locks" add constraint "wizard_locks_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."wizard_locks" drop constraint if exists "wizard_locks_char_sheet_id_foreign";
  `)
}
