// 8_char_advantage_notes.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_advantage_notes" (
    "id" uuid not null default gen_random_uuid(),
    "char_sheet_id" uuid not null,
    "label" text not null,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "category" text not null default 'narrative'::text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_advantage_notes" cascade;
  `)
}
