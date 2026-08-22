// 6_campaign_members.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."campaign_members" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "user_id" uuid not null,
    "role" text not null,
    "character_name" text,
    "sheet_data" jsonb,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."campaign_members" cascade;
  `)
}
