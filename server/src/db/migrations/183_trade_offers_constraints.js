// 183_trade_offers_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX trade_offers_pkey ON public.trade_offers USING btree (id);

alter table "public"."trade_offers" add constraint "trade_offers_pkey" PRIMARY KEY using index "trade_offers_pkey";

alter table "public"."trade_offers" add constraint "chk_trade_offer_status" CHECK ((status = ANY (ARRAY['PENDING'::text, 'COUNTER_OFFERED'::text, 'ACCEPTED'::text, 'DECLINED'::text, 'CANCELLED'::text])));

alter table "public"."trade_offers" add constraint "chk_trade_offer_type" CHECK ((type = ANY (ARRAY['EXCHANGE'::text, 'SELL'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."trade_offers" drop constraint if exists "chk_trade_offer_type";
alter table "public"."trade_offers" drop constraint if exists "chk_trade_offer_status";
alter table "public"."trade_offers" drop constraint if exists "trade_offers_pkey";
  `)
}
