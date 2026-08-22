// 228_combat_timeline_entries_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."combat_timeline_entries" add constraint "combat_timeline_entries_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."combat_timeline_entries" add constraint "combat_timeline_entries_combat_action_id_foreign" FOREIGN KEY (combat_action_id) REFERENCES combat_actions(id) ON DELETE CASCADE;

alter table "public"."combat_timeline_entries" add constraint "combat_timeline_entries_token_id_foreign" FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."combat_timeline_entries" drop constraint if exists "combat_timeline_entries_token_id_foreign";
alter table "public"."combat_timeline_entries" drop constraint if exists "combat_timeline_entries_combat_action_id_foreign";
alter table "public"."combat_timeline_entries" drop constraint if exists "combat_timeline_entries_campaign_id_foreign";
  `)
}
