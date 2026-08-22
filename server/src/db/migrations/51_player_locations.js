// 51_player_locations.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."player_locations" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "user_id" uuid not null,
    "battlemap_id" uuid,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."player_locations" cascade;
  `)
}
