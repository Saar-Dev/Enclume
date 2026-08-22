// 26_character_states.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."character_states" (
    "id" uuid not null default gen_random_uuid(),
    "token_id" uuid not null,
    "axis" text not null,
    "value_code" text not null,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."character_states" cascade;
  `)
}
