// 244_pending_catastrophes_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."pending_catastrophes" add constraint "pending_catastrophes_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."pending_catastrophes" add constraint "pending_catastrophes_resolved_by_foreign" FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;

alter table "public"."pending_catastrophes" add constraint "pending_catastrophes_token_id_foreign" FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."pending_catastrophes" drop constraint if exists "pending_catastrophes_token_id_foreign";
alter table "public"."pending_catastrophes" drop constraint if exists "pending_catastrophes_resolved_by_foreign";
alter table "public"."pending_catastrophes" drop constraint if exists "pending_catastrophes_campaign_id_foreign";
  `)
}
