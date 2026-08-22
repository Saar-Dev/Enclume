// 9_char_advantages.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_advantages" (
    "id" uuid not null default gen_random_uuid(),
    "char_sheet_id" uuid not null,
    "advantage_id" text not null,
    "snapshot_data" jsonb not null,
    "acquired_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "acquired_during" text not null,
    "removed_at" timestamp with time zone,
    "removal_reason" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_advantages" cascade;
  `)
}
