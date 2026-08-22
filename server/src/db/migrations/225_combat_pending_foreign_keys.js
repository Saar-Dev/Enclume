// 225_combat_pending_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."combat_pending" add constraint "combat_pending_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."combat_pending" add constraint "combat_pending_token_id_foreign" FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."combat_pending" drop constraint if exists "combat_pending_token_id_foreign";
alter table "public"."combat_pending" drop constraint if exists "combat_pending_campaign_id_foreign";
  `)
}
