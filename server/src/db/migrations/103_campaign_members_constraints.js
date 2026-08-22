// 103_campaign_members_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX campaign_members_campaign_id_user_id_unique ON public.campaign_members USING btree (campaign_id, user_id);

CREATE UNIQUE INDEX campaign_members_pkey ON public.campaign_members USING btree (id);

alter table "public"."campaign_members" add constraint "campaign_members_pkey" PRIMARY KEY using index "campaign_members_pkey";

alter table "public"."campaign_members" add constraint "campaign_members_campaign_id_user_id_unique" UNIQUE using index "campaign_members_campaign_id_user_id_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."campaign_members" drop constraint if exists "campaign_members_campaign_id_user_id_unique";
alter table "public"."campaign_members" drop constraint if exists "campaign_members_pkey";
  `)
}
