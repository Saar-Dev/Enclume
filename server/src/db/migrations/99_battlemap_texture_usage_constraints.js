// 99_battlemap_texture_usage_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX battlemap_texture_usage_pkey ON public.battlemap_texture_usage USING btree (battlemap_id, voxel_texture_id);

alter table "public"."battlemap_texture_usage" add constraint "battlemap_texture_usage_pkey" PRIMARY KEY using index "battlemap_texture_usage_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."battlemap_texture_usage" drop constraint if exists "battlemap_texture_usage_pkey";
  `)
}
