// 21_char_polaris.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_polaris" (
    "char_sheet_id" uuid not null,
    "state" text not null,
    "powers" jsonb
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_polaris" cascade;
  `)
}
