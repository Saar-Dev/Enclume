// 219_character_macros_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."character_macros" add constraint "character_macros_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."character_macros" drop constraint if exists "character_macros_character_id_foreign";
  `)
}
