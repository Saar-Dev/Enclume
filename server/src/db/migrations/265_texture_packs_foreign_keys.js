// 265_texture_packs_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."texture_packs" add constraint "texture_packs_created_by_foreign" FOREIGN KEY (created_by) REFERENCES users(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."texture_packs" drop constraint if exists "texture_packs_created_by_foreign";
  `)
}
