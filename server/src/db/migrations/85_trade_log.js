// 85_trade_log.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."trade_log" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "type" text not null,
    "from_char_id" uuid,
    "to_char_id" uuid,
    "merchant_id" uuid,
    "sols_delta" integer not null default 0,
    "items_json" jsonb not null default '[]'::jsonb,
    "note" text,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."trade_log" cascade;
  `)
}
