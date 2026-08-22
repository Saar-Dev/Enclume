// 33_combat_state.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."combat_state" (
    "campaign_id" uuid not null,
    "battlemap_id" uuid,
    "phase" text not null,
    "current_turn" integer not null default 1,
    "action_timer_sec" integer not null default 0,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "sub_phase" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."combat_state" cascade;
  `)
}
