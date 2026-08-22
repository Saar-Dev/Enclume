// 102_campaign_documents_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX campaign_documents_pkey ON public.campaign_documents USING btree (id);

alter table "public"."campaign_documents" add constraint "campaign_documents_pkey" PRIMARY KEY using index "campaign_documents_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."campaign_documents" drop constraint if exists "campaign_documents_pkey";
  `)
}
