// 127_combat_actions_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX combat_actions_pkey ON public.combat_actions USING btree (id);

CREATE INDEX idx_actions_campaign ON public.combat_actions USING btree (campaign_id);

CREATE INDEX idx_actions_key ON public.combat_actions USING btree (campaign_id, action_key);

CREATE INDEX idx_actions_token ON public.combat_actions USING btree (campaign_id, token_id);

alter table "public"."combat_actions" add constraint "combat_actions_pkey" PRIMARY KEY using index "combat_actions_pkey";

alter table "public"."combat_actions" add constraint "chk_action_status" CHECK ((status = ANY (ARRAY['pending'::text, 'resolved'::text, 'skipped'::text])));

alter table "public"."combat_actions" add constraint "chk_action_type" CHECK ((type = ANY (ARRAY['assault'::text, 'move_short'::text, 'move_long'::text, 'micro'::text, 'skip'::text, 'reload'::text, 'melee'::text, 'exo_stand_up'::text])));

alter table "public"."combat_actions" add constraint "chk_combat_destination_world" CHECK (((destination_world IS NULL) OR ((jsonb_typeof(destination_world) = 'object'::text) AND ((destination_world -> 'x'::text) IS NOT NULL) AND ((destination_world -> 'y'::text) IS NOT NULL) AND ((destination_world -> 'z'::text) IS NOT NULL) AND (jsonb_typeof((destination_world -> 'x'::text)) = 'number'::text) AND (jsonb_typeof((destination_world -> 'y'::text)) = 'number'::text) AND (jsonb_typeof((destination_world -> 'z'::text)) = 'number'::text))));

alter table "public"."combat_actions" add constraint "chk_combat_movement_gait" CHECK (((movement_gait IS NULL) OR (movement_gait = ANY (ARRAY['lente'::text, 'moyenne'::text, 'rapide'::text, 'max'::text]))));

alter table "public"."combat_actions" add constraint "chk_combat_world_plan_for_move" CHECK (((type <> ALL (ARRAY['move_short'::text, 'move_long'::text])) OR (status <> 'pending'::text) OR ((movement_gait IS NOT NULL) AND (destination_world IS NOT NULL) AND (world_plan IS NOT NULL) AND (planned_world_revision IS NOT NULL) AND (planned_runtime_revision IS NOT NULL) AND (planned_budget_m IS NOT NULL))));

alter table "public"."combat_actions" add constraint "chk_offhand_requires_primary" CHECK (((offhand_weapon_inv_id IS NULL) OR (weapon_inv_id IS NOT NULL)));

alter table "public"."combat_actions" add constraint "chk_weapon_xor" CHECK (((weapon_inv_id IS NULL) OR (drone_weapon_inv_id IS NULL)));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."combat_actions" drop constraint if exists "chk_weapon_xor";
alter table "public"."combat_actions" drop constraint if exists "chk_offhand_requires_primary";
alter table "public"."combat_actions" drop constraint if exists "chk_combat_world_plan_for_move";
alter table "public"."combat_actions" drop constraint if exists "chk_combat_movement_gait";
alter table "public"."combat_actions" drop constraint if exists "chk_combat_destination_world";
alter table "public"."combat_actions" drop constraint if exists "chk_action_type";
alter table "public"."combat_actions" drop constraint if exists "chk_action_status";
alter table "public"."combat_actions" drop constraint if exists "combat_actions_pkey";
drop index if exists "idx_actions_campaign";
drop index if exists "idx_actions_key";
drop index if exists "idx_actions_token";
  `)
}
