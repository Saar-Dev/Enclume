// 144_game_echeances_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX game_echeances_pkey ON public.game_echeances USING btree (id);

CREATE INDEX idx_echeances_campaign_id ON public.game_echeances USING btree (campaign_id);

alter table "public"."game_echeances" add constraint "game_echeances_pkey" PRIMARY KEY using index "game_echeances_pkey";

alter table "public"."game_echeances" add constraint "chk_echeances_status" CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text, 'error'::text, 'pending_mj_review'::text, 'awaiting_player_roll'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."game_echeances" drop constraint if exists "chk_echeances_status";
alter table "public"."game_echeances" drop constraint if exists "game_echeances_pkey";
drop index if exists "idx_echeances_campaign_id";
  `)
}
