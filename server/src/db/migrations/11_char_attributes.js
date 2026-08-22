// 11_char_attributes.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_attributes" (
    "char_sheet_id" uuid not null,
    "attr_id" text not null,
    "base_level" integer not null default 7,
    "pc_modifier" integer default 0
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_attributes" cascade;
  `)
}
