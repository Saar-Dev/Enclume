// 130_combat_state_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX combat_state_pkey ON public.combat_state USING btree (campaign_id);

alter table "public"."combat_state" add constraint "combat_state_pkey" PRIMARY KEY using index "combat_state_pkey";

alter table "public"."combat_state" add constraint "chk_combat_phase" CHECK ((phase = ANY (ARRAY['ROSTER'::text, 'ANNOUNCEMENT'::text, 'RESOLUTION'::text])));

alter table "public"."combat_state" add constraint "chk_combat_sub_phase" CHECK ((sub_phase = ANY (ARRAY['SLOT_ACTIVE'::text, 'AWAITING_DEFENSE'::text, 'AWAITING_DAMAGE'::text, 'AWAITING_REACTION_WINDOW'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."combat_state" drop constraint if exists "chk_combat_sub_phase";
alter table "public"."combat_state" drop constraint if exists "chk_combat_phase";
alter table "public"."combat_state" drop constraint if exists "combat_state_pkey";
  `)
}
