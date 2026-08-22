// 200_campaign_members_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."campaign_members" add constraint "campaign_members_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."campaign_members" add constraint "campaign_members_user_id_foreign" FOREIGN KEY (user_id) REFERENCES users(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."campaign_members" drop constraint if exists "campaign_members_user_id_foreign";
alter table "public"."campaign_members" drop constraint if exists "campaign_members_campaign_id_foreign";
  `)
}
