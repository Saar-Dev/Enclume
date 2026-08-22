// 148_player_locations_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX player_locations_campaign_id_user_id_unique ON public.player_locations USING btree (campaign_id, user_id);

CREATE UNIQUE INDEX player_locations_pkey ON public.player_locations USING btree (id);

alter table "public"."player_locations" add constraint "player_locations_pkey" PRIMARY KEY using index "player_locations_pkey";

alter table "public"."player_locations" add constraint "player_locations_campaign_id_user_id_unique" UNIQUE using index "player_locations_campaign_id_user_id_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."player_locations" drop constraint if exists "player_locations_campaign_id_user_id_unique";
alter table "public"."player_locations" drop constraint if exists "player_locations_pkey";
  `)
}
