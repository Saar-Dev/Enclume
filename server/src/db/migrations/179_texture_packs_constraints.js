// 179_texture_packs_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX texture_packs_name_unique ON public.texture_packs USING btree (name);

CREATE UNIQUE INDEX texture_packs_pkey ON public.texture_packs USING btree (id);

alter table "public"."texture_packs" add constraint "texture_packs_pkey" PRIMARY KEY using index "texture_packs_pkey";

alter table "public"."texture_packs" add constraint "texture_packs_name_unique" UNIQUE using index "texture_packs_name_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."texture_packs" drop constraint if exists "texture_packs_name_unique";
alter table "public"."texture_packs" drop constraint if exists "texture_packs_pkey";
  `)
}
