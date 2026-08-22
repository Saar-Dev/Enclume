// 264_texture_pack_categories_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."texture_pack_categories" add constraint "texture_pack_categories_pack_id_foreign" FOREIGN KEY (pack_id) REFERENCES texture_packs(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."texture_pack_categories" drop constraint if exists "texture_pack_categories_pack_id_foreign";
  `)
}
