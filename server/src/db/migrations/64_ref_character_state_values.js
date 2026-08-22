// 64_ref_character_state_values.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_character_state_values" (
    "id" uuid not null default gen_random_uuid(),
    "axis" text not null,
    "value_code" text not null,
    "label" text not null
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_character_state_values" cascade;
  `)
}
