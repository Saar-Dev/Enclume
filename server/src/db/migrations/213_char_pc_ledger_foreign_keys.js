// 213_char_pc_ledger_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_pc_ledger" add constraint "char_pc_ledger_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_pc_ledger" drop constraint if exists "char_pc_ledger_char_sheet_id_foreign";
  `)
}
