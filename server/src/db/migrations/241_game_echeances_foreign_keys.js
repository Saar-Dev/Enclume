// 241_game_echeances_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."game_echeances" add constraint "game_echeances_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."game_echeances" add constraint "game_echeances_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."game_echeances" drop constraint if exists "game_echeances_character_id_foreign";
alter table "public"."game_echeances" drop constraint if exists "game_echeances_campaign_id_foreign";
  `)
}
