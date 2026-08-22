// 196_battlemap_texture_usage_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."battlemap_texture_usage" add constraint "battlemap_texture_usage_battlemap_id_foreign" FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE CASCADE;

alter table "public"."battlemap_texture_usage" add constraint "battlemap_texture_usage_voxel_texture_id_foreign" FOREIGN KEY (voxel_texture_id) REFERENCES voxel_textures(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."battlemap_texture_usage" drop constraint if exists "battlemap_texture_usage_voxel_texture_id_foreign";
alter table "public"."battlemap_texture_usage" drop constraint if exists "battlemap_texture_usage_battlemap_id_foreign";
  `)
}
