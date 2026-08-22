// 194_world_feature_states_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX world_feature_states_pkey ON public.world_feature_states USING btree (battlemap_id, feature_id);

alter table "public"."world_feature_states" add constraint "world_feature_states_pkey" PRIMARY KEY using index "world_feature_states_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."world_feature_states" drop constraint if exists "world_feature_states_pkey";
  `)
}
