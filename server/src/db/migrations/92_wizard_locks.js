// 92_wizard_locks.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."wizard_locks" (
    "id" uuid not null default gen_random_uuid(),
    "char_sheet_id" uuid not null,
    "step" integer not null,
    "option_key" text not null,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."wizard_locks" cascade;
  `)
}
