// 84_tokens.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."tokens" (
    "id" uuid not null default gen_random_uuid(),
    "battlemap_id" uuid not null,
    "owner_id" uuid,
    "label" text,
    "image_url" text,
    "pos_x" real not null default '0'::real,
    "pos_y" real not null default '0'::real,
    "width" real not null default '50'::real,
    "height" real not null default '50'::real,
    "z_index" integer default 0,
    "visible_to_players" boolean default true,
    "layer" text not null default 'token'::text,
    "cover_percent" integer not null default 0,
    "notes" text,
    "gm_notes" text,
    "pos_z" real not null default '0'::real,
    "character_id" uuid,
    "color" character varying(7),
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "r" integer not null default 0,
    "position_space" text not null default 'world-feet'::text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."tokens" cascade;
  `)
}
