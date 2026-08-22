// 20_char_personal_advantages.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_personal_advantages" (
    "char_sheet_id" uuid not null,
    "advantage_id" text not null,
    "type" text not null
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_personal_advantages" cascade;
  `)
}
