// 1_battlemap_folders.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."battlemap_folders" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "parent_folder_id" uuid,
    "name" text not null,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."battlemap_folders" cascade;
  `)
}
