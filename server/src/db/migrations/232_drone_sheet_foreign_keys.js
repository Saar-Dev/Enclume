// 232_drone_sheet_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."drone_sheet" add constraint "drone_sheet_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."drone_sheet" drop constraint if exists "drone_sheet_character_id_foreign";
  `)
}
