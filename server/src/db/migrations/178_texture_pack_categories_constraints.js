// 178_texture_pack_categories_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX texture_pack_categories_pkey ON public.texture_pack_categories USING btree (id);

alter table "public"."texture_pack_categories" add constraint "texture_pack_categories_pkey" PRIMARY KEY using index "texture_pack_categories_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."texture_pack_categories" drop constraint if exists "texture_pack_categories_pkey";
  `)
}
