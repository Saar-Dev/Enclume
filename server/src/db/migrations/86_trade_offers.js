// 86_trade_offers.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."trade_offers" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "from_char_id" uuid not null,
    "to_char_id" uuid,
    "status" text not null default 'PENDING'::text,
    "items_json" jsonb not null default '[]'::jsonb,
    "sols_offer" integer not null default 0,
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone,
    "type" text not null default 'EXCHANGE'::text,
    "counter_sols" integer,
    "merchant_id" uuid
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."trade_offers" cascade;
  `)
}
