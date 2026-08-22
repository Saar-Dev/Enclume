// 182_trade_log_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX trade_log_pkey ON public.trade_log USING btree (id);

alter table "public"."trade_log" add constraint "trade_log_pkey" PRIMARY KEY using index "trade_log_pkey";

alter table "public"."trade_log" add constraint "chk_trade_log_type" CHECK ((type = ANY (ARRAY['merchant_buy'::text, 'player_transfer'::text, 'gm_grant'::text, 'player_sell'::text, 'drone_reload'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."trade_log" drop constraint if exists "chk_trade_log_type";
alter table "public"."trade_log" drop constraint if exists "trade_log_pkey";
  `)
}
