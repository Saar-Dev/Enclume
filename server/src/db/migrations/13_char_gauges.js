// 13_char_gauges.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_gauges" (
    "char_sheet_id" uuid not null,
    "category_key" text not null,
    "value" integer not null default 0
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_gauges" cascade;
  `)
}
