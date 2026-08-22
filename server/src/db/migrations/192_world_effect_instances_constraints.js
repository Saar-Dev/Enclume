// 192_world_effect_instances_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE INDEX world_effect_instances_battlemap_id_state_index ON public.world_effect_instances USING btree (battlemap_id, state);

CREATE INDEX world_effect_instances_battlemap_id_target_kind_target_id_index ON public.world_effect_instances USING btree (battlemap_id, target_kind, target_id);

CREATE UNIQUE INDEX world_effect_instances_pkey ON public.world_effect_instances USING btree (id);

alter table "public"."world_effect_instances" add constraint "world_effect_instances_pkey" PRIMARY KEY using index "world_effect_instances_pkey";

alter table "public"."world_effect_instances" add constraint "chk_world_effect_intensity" CHECK (((intensity > (0)::numeric) AND (intensity <= (100)::numeric)));

alter table "public"."world_effect_instances" add constraint "chk_world_effect_state" CHECK ((state = ANY (ARRAY['active'::text, 'paused'::text, 'expired'::text])));

alter table "public"."world_effect_instances" add constraint "chk_world_effect_target" CHECK ((((target_kind = 'volume'::text) AND (volume IS NOT NULL)) OR ((target_kind <> 'volume'::text) AND (target_id IS NOT NULL))));

alter table "public"."world_effect_instances" add constraint "chk_world_effect_target_kind" CHECK ((target_kind = ANY (ARRAY['volume'::text, 'support'::text, 'feature'::text, 'compartment'::text, 'entity'::text, 'token'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."world_effect_instances" drop constraint if exists "chk_world_effect_target_kind";
alter table "public"."world_effect_instances" drop constraint if exists "chk_world_effect_target";
alter table "public"."world_effect_instances" drop constraint if exists "chk_world_effect_state";
alter table "public"."world_effect_instances" drop constraint if exists "chk_world_effect_intensity";
alter table "public"."world_effect_instances" drop constraint if exists "world_effect_instances_pkey";
drop index if exists "world_effect_instances_battlemap_id_state_index";
drop index if exists "world_effect_instances_battlemap_id_target_kind_target_id_index";
  `)
}
