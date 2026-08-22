// 96_world_elevator_passengers.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."world_elevator_passengers" (
    "battlemap_id" uuid not null,
    "elevator_id" uuid not null,
    "token_id" uuid not null,
    "local_position" jsonb not null,
    "boarded_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."world_elevator_passengers" cascade;
  `)
}
