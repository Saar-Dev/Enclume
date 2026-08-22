// 243_merchants_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."merchants" add constraint "merchants_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."merchants" drop constraint if exists "merchants_campaign_id_foreign";
  `)
}
