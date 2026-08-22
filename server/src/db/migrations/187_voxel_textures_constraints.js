// 187_voxel_textures_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX voxel_textures_pkey ON public.voxel_textures USING btree (id);

alter table "public"."voxel_textures" add constraint "voxel_textures_pkey" PRIMARY KEY using index "voxel_textures_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."voxel_textures" drop constraint if exists "voxel_textures_pkey";
  `)
}
