// 128_combat_pending_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE INDEX combat_pending_fifo_idx ON public.combat_pending USING btree (campaign_id, token_id, type, created_at);

CREATE UNIQUE INDEX combat_pending_pkey ON public.combat_pending USING btree (id);

CREATE UNIQUE INDEX combat_pending_unique_non_damage ON public.combat_pending USING btree (campaign_id, token_id, type) WHERE (type <> 'damage'::text);

alter table "public"."combat_pending" add constraint "combat_pending_pkey" PRIMARY KEY using index "combat_pending_pkey";

alter table "public"."combat_pending" add constraint "chk_pending_type" CHECK ((type = ANY (ARRAY['melee_defense'::text, 'damage'::text, 'stun'::text, 'surprise'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."combat_pending" drop constraint if exists "chk_pending_type";
alter table "public"."combat_pending" drop constraint if exists "combat_pending_pkey";
drop index if exists "combat_pending_fifo_idx";
drop index if exists "combat_pending_unique_non_damage";
  `)
}
