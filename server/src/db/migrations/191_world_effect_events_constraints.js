// 191_world_effect_events_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE INDEX world_effect_events_battlemap_id_created_at_index ON public.world_effect_events USING btree (battlemap_id, created_at);

CREATE UNIQUE INDEX world_effect_events_pkey ON public.world_effect_events USING btree (id);

alter table "public"."world_effect_events" add constraint "world_effect_events_pkey" PRIMARY KEY using index "world_effect_events_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."world_effect_events" drop constraint if exists "world_effect_events_pkey";
drop index if exists "world_effect_events_battlemap_id_created_at_index";
  `)
}
