// 190_world_effect_definitions_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX world_effect_definitions_campaign_id_effect_key_unique ON public.world_effect_definitions USING btree (campaign_id, effect_key);

CREATE UNIQUE INDEX world_effect_definitions_pkey ON public.world_effect_definitions USING btree (id);

alter table "public"."world_effect_definitions" add constraint "world_effect_definitions_pkey" PRIMARY KEY using index "world_effect_definitions_pkey";

alter table "public"."world_effect_definitions" add constraint "chk_world_effect_stacking" CHECK ((stacking = ANY (ARRAY['max'::text, 'multiply'::text])));

alter table "public"."world_effect_definitions" add constraint "world_effect_definitions_campaign_id_effect_key_unique" UNIQUE using index "world_effect_definitions_campaign_id_effect_key_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."world_effect_definitions" drop constraint if exists "world_effect_definitions_campaign_id_effect_key_unique";
alter table "public"."world_effect_definitions" drop constraint if exists "chk_world_effect_stacking";
alter table "public"."world_effect_definitions" drop constraint if exists "world_effect_definitions_pkey";
  `)
}
