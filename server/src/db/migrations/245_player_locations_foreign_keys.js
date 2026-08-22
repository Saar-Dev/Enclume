// 245_player_locations_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."player_locations" add constraint "player_locations_battlemap_id_foreign" FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE SET NULL;

alter table "public"."player_locations" add constraint "player_locations_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."player_locations" add constraint "player_locations_user_id_foreign" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."player_locations" drop constraint if exists "player_locations_user_id_foreign";
alter table "public"."player_locations" drop constraint if exists "player_locations_campaign_id_foreign";
alter table "public"."player_locations" drop constraint if exists "player_locations_battlemap_id_foreign";
  `)
}
