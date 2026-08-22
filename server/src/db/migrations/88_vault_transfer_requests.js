// 88_vault_transfer_requests.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."vault_transfer_requests" (
    "id" uuid not null default gen_random_uuid(),
    "vault_character_id" uuid not null,
    "target_campaign_id" uuid not null,
    "requested_by" uuid,
    "status" text not null default 'pending'::text,
    "reviewed_by" uuid,
    "reviewed_at" timestamp with time zone,
    "created_character_id" uuid,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."vault_transfer_requests" cascade;
  `)
}
