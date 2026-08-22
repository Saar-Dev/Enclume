// 129_combat_roster_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX combat_roster_pkey ON public.combat_roster USING btree (id);

CREATE INDEX idx_roster_campaign ON public.combat_roster USING btree (campaign_id);

CREATE UNIQUE INDEX uq_roster_campaign_token ON public.combat_roster USING btree (campaign_id, token_id);

alter table "public"."combat_roster" add constraint "combat_roster_pkey" PRIMARY KEY using index "combat_roster_pkey";

alter table "public"."combat_roster" add constraint "chk_roster_status" CHECK ((status = ANY (ARRAY['active'::text, 'done'::text])));

alter table "public"."combat_roster" add constraint "chk_state_combat_mode" CHECK ((state_combat_mode = ANY (ARRAY['normal'::text, 'offensif'::text, 'charge'::text, 'defensif'::text, 'retraite'::text])));

alter table "public"."combat_roster" add constraint "chk_state_cover" CHECK ((state_cover = ANY (ARRAY['exposed'::text, 'partial'::text, 'important'::text])));

alter table "public"."combat_roster" add constraint "chk_state_fire_mode" CHECK ((state_fire_mode = ANY (ARRAY['cc'::text, 'rc'::text, 'rl'::text])));

alter table "public"."combat_roster" add constraint "chk_state_position" CHECK ((state_position = ANY (ARRAY['standing'::text, 'crouching'::text, 'kneeling'::text, 'prone'::text])));

alter table "public"."combat_roster" add constraint "chk_state_vitesse" CHECK ((state_vitesse = ANY (ARRAY['normal'::text, 'delayed'::text, 'rushed'::text])));

alter table "public"."combat_roster" add constraint "chk_state_weapon" CHECK ((state_weapon = ANY (ARRAY['holstered'::text, 'ready'::text, 'drawn'::text])));

alter table "public"."combat_roster" add constraint "uq_roster_campaign_token" UNIQUE using index "uq_roster_campaign_token";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."combat_roster" drop constraint if exists "uq_roster_campaign_token";
alter table "public"."combat_roster" drop constraint if exists "chk_state_weapon";
alter table "public"."combat_roster" drop constraint if exists "chk_state_vitesse";
alter table "public"."combat_roster" drop constraint if exists "chk_state_position";
alter table "public"."combat_roster" drop constraint if exists "chk_state_fire_mode";
alter table "public"."combat_roster" drop constraint if exists "chk_state_cover";
alter table "public"."combat_roster" drop constraint if exists "chk_state_combat_mode";
alter table "public"."combat_roster" drop constraint if exists "chk_roster_status";
alter table "public"."combat_roster" drop constraint if exists "combat_roster_pkey";
drop index if exists "idx_roster_campaign";
  `)
}
