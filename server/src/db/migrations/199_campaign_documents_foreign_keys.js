// 199_campaign_documents_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."campaign_documents" add constraint "campaign_documents_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."campaign_documents" add constraint "campaign_documents_created_by_foreign" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."campaign_documents" drop constraint if exists "campaign_documents_created_by_foreign";
alter table "public"."campaign_documents" drop constraint if exists "campaign_documents_campaign_id_foreign";
  `)
}
