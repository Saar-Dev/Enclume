// 267_tokens_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."tokens" add constraint "tokens_battlemap_id_foreign" FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE CASCADE;

alter table "public"."tokens" add constraint "tokens_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL;

alter table "public"."tokens" add constraint "tokens_owner_id_foreign" FOREIGN KEY (owner_id) REFERENCES users(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."tokens" drop constraint if exists "tokens_owner_id_foreign";
alter table "public"."tokens" drop constraint if exists "tokens_character_id_foreign";
alter table "public"."tokens" drop constraint if exists "tokens_battlemap_id_foreign";
  `)
}
