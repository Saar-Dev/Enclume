// 271_vault_transfer_requests_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."vault_transfer_requests" add constraint "vault_transfer_requests_created_character_id_foreign" FOREIGN KEY (created_character_id) REFERENCES characters(id) ON DELETE SET NULL;

alter table "public"."vault_transfer_requests" add constraint "vault_transfer_requests_requested_by_foreign" FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;

alter table "public"."vault_transfer_requests" add constraint "vault_transfer_requests_reviewed_by_foreign" FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

alter table "public"."vault_transfer_requests" add constraint "vault_transfer_requests_target_campaign_id_foreign" FOREIGN KEY (target_campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."vault_transfer_requests" add constraint "vault_transfer_requests_vault_character_id_foreign" FOREIGN KEY (vault_character_id) REFERENCES characters(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."vault_transfer_requests" drop constraint if exists "vault_transfer_requests_vault_character_id_foreign";
alter table "public"."vault_transfer_requests" drop constraint if exists "vault_transfer_requests_target_campaign_id_foreign";
alter table "public"."vault_transfer_requests" drop constraint if exists "vault_transfer_requests_reviewed_by_foreign";
alter table "public"."vault_transfer_requests" drop constraint if exists "vault_transfer_requests_requested_by_foreign";
alter table "public"."vault_transfer_requests" drop constraint if exists "vault_transfer_requests_created_character_id_foreign";
  `)
}
