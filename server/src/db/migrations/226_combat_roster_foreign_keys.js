// 226_combat_roster_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."combat_roster" add constraint "combat_roster_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."combat_roster" add constraint "combat_roster_token_id_foreign" FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."combat_roster" drop constraint if exists "combat_roster_token_id_foreign";
alter table "public"."combat_roster" drop constraint if exists "combat_roster_campaign_id_foreign";
  `)
}
