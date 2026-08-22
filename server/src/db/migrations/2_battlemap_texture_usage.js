// 2_battlemap_texture_usage.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."battlemap_texture_usage" (
    "battlemap_id" uuid not null,
    "voxel_texture_id" integer not null
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."battlemap_texture_usage" cascade;
  `)
}
