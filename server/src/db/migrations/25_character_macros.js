// 25_character_macros.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."character_macros" (
    "id" uuid not null default gen_random_uuid(),
    "character_id" uuid not null,
    "label" text not null,
    "sources" jsonb not null default '[]'::jsonb,
    "modifier" integer not null default 0,
    "template" text,
    "sort_order" smallint not null default '0'::smallint,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."character_macros" cascade;
  `)
}
