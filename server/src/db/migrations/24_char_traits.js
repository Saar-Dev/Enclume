// 24_char_traits.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_traits" (
    "id" uuid not null default gen_random_uuid(),
    "char_sheet_id" uuid not null,
    "trait_type" text not null,
    "params" jsonb
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_traits" cascade;
  `)
}
