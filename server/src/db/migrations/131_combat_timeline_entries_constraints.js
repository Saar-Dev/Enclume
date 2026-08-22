// 131_combat_timeline_entries_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX combat_timeline_entries_pkey ON public.combat_timeline_entries USING btree (id);

CREATE INDEX idx_timeline_entries_token ON public.combat_timeline_entries USING btree (campaign_id, token_id);

CREATE INDEX idx_timeline_entries_turn ON public.combat_timeline_entries USING btree (campaign_id, turn_number, status);

alter table "public"."combat_timeline_entries" add constraint "combat_timeline_entries_pkey" PRIMARY KEY using index "combat_timeline_entries_pkey";

alter table "public"."combat_timeline_entries" add constraint "chk_timeline_entry_status" CHECK ((status = ANY (ARRAY['delayed_waiting'::text, 'scheduled'::text, 'resolved'::text, 'lost'::text, 'skipped'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."combat_timeline_entries" drop constraint if exists "chk_timeline_entry_status";
alter table "public"."combat_timeline_entries" drop constraint if exists "combat_timeline_entries_pkey";
drop index if exists "idx_timeline_entries_token";
drop index if exists "idx_timeline_entries_turn";
  `)
}
