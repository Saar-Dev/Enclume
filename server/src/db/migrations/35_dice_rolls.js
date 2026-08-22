// 35_dice_rolls.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."dice_rolls" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "user_id" uuid not null,
    "formula" text not null,
    "results" jsonb not null,
    "total" integer not null,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."dice_rolls" cascade;
  `)
}
