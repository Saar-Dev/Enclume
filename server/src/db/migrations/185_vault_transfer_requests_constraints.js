// 185_vault_transfer_requests_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX uq_vault_transfer_pending ON public.vault_transfer_requests USING btree (vault_character_id, target_campaign_id) WHERE (status = 'pending'::text);

CREATE UNIQUE INDEX vault_transfer_requests_pkey ON public.vault_transfer_requests USING btree (id);

alter table "public"."vault_transfer_requests" add constraint "vault_transfer_requests_pkey" PRIMARY KEY using index "vault_transfer_requests_pkey";

alter table "public"."vault_transfer_requests" add constraint "chk_vault_transfer_requests_status" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."vault_transfer_requests" drop constraint if exists "chk_vault_transfer_requests_status";
alter table "public"."vault_transfer_requests" drop constraint if exists "vault_transfer_requests_pkey";
drop index if exists "uq_vault_transfer_pending";
  `)
}
