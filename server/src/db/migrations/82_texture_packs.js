// 82_texture_packs.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."texture_packs" (
    "id" uuid not null default gen_random_uuid(),
    "name" character varying(255) not null,
    "label" character varying(255) not null,
    "description" text,
    "tile_size" integer default 128,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."texture_packs" cascade;
  `)
}
