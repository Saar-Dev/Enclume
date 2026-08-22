// 236_exo_computers_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."exo_computers" add constraint "exo_computers_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."exo_computers" drop constraint if exists "exo_computers_character_id_foreign";
  `)
}
