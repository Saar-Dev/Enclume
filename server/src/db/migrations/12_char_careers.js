// 12_char_careers.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_careers" (
    "id" uuid not null default gen_random_uuid(),
    "char_sheet_id" uuid not null,
    "career_id" uuid not null,
    "years" integer not null,
    "savings" integer default 0,
    "pro_advantages" jsonb,
    "random_picks" jsonb,
    "setbacks" jsonb,
    "random_effects_applied" jsonb not null default '[]'::jsonb
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_careers" cascade;
  `)
}
