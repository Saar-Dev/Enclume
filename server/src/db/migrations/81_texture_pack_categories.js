// 81_texture_pack_categories.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."texture_pack_categories" (
    "id" uuid not null default gen_random_uuid(),
    "pack_id" uuid not null,
    "label" character varying(255) not null,
    "sort_order" integer default 0
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."texture_pack_categories" cascade;
  `)
}
