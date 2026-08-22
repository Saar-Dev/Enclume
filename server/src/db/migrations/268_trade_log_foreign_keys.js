// 268_trade_log_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."trade_log" add constraint "trade_log_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."trade_log" add constraint "trade_log_from_char_id_foreign" FOREIGN KEY (from_char_id) REFERENCES characters(id) ON DELETE SET NULL;

alter table "public"."trade_log" add constraint "trade_log_merchant_id_foreign" FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE SET NULL;

alter table "public"."trade_log" add constraint "trade_log_to_char_id_foreign" FOREIGN KEY (to_char_id) REFERENCES characters(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."trade_log" drop constraint if exists "trade_log_to_char_id_foreign";
alter table "public"."trade_log" drop constraint if exists "trade_log_merchant_id_foreign";
alter table "public"."trade_log" drop constraint if exists "trade_log_from_char_id_foreign";
alter table "public"."trade_log" drop constraint if exists "trade_log_campaign_id_foreign";
  `)
}
