// 269_trade_offers_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."trade_offers" add constraint "trade_offers_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."trade_offers" add constraint "trade_offers_from_char_id_foreign" FOREIGN KEY (from_char_id) REFERENCES characters(id) ON DELETE CASCADE;

alter table "public"."trade_offers" add constraint "trade_offers_merchant_id_fkey" FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE SET NULL;

alter table "public"."trade_offers" add constraint "trade_offers_to_char_id_foreign" FOREIGN KEY (to_char_id) REFERENCES characters(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."trade_offers" drop constraint if exists "trade_offers_to_char_id_foreign";
alter table "public"."trade_offers" drop constraint if exists "trade_offers_merchant_id_fkey";
alter table "public"."trade_offers" drop constraint if exists "trade_offers_from_char_id_foreign";
alter table "public"."trade_offers" drop constraint if exists "trade_offers_campaign_id_foreign";
  `)
}
