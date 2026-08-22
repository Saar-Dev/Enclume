// 273_voxel_textures_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."voxel_textures" add constraint "voxel_textures_category_id_foreign" FOREIGN KEY (category_id) REFERENCES texture_pack_categories(id);

alter table "public"."voxel_textures" add constraint "voxel_textures_pack_id_foreign" FOREIGN KEY (pack_id) REFERENCES texture_packs(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."voxel_textures" drop constraint if exists "voxel_textures_pack_id_foreign";
alter table "public"."voxel_textures" drop constraint if exists "voxel_textures_category_id_foreign";
  `)
}
