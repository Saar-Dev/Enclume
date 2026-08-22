// 230_documents_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."documents" add constraint "documents_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."documents" add constraint "documents_uploaded_by_foreign" FOREIGN KEY (uploaded_by) REFERENCES users(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."documents" drop constraint if exists "documents_uploaded_by_foreign";
alter table "public"."documents" drop constraint if exists "documents_campaign_id_foreign";
  `)
}
