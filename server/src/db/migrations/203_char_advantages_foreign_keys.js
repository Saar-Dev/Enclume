// 203_char_advantages_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_advantages" add constraint "char_advantages_advantage_id_foreign" FOREIGN KEY (advantage_id) REFERENCES ref_advantages(advantage_id);

alter table "public"."char_advantages" add constraint "char_advantages_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_advantages" drop constraint if exists "char_advantages_char_sheet_id_foreign";
alter table "public"."char_advantages" drop constraint if exists "char_advantages_advantage_id_foreign";
  `)
}
