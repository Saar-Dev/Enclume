// 101_bug_tickets_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX bug_tickets_pkey ON public.bug_tickets USING btree (id);

alter table "public"."bug_tickets" add constraint "bug_tickets_pkey" PRIMARY KEY using index "bug_tickets_pkey";

alter table "public"."bug_tickets" add constraint "chk_bug_tickets_category" CHECK ((category = ANY (ARRAY['bug'::text, 'balance'::text, 'suggestion'::text, 'other'::text])));

alter table "public"."bug_tickets" add constraint "chk_bug_tickets_origin" CHECK ((origin = ANY (ARRAY['player'::text, 'gm'::text, 'admin'::text, 'log'::text])));

alter table "public"."bug_tickets" add constraint "chk_bug_tickets_priority" CHECK (((priority IS NULL) OR (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))));

alter table "public"."bug_tickets" add constraint "chk_bug_tickets_status" CHECK ((status = ANY (ARRAY['new'::text, 'triaged'::text, 'in_progress'::text, 'suspended'::text, 'resolved'::text, 'wont_fix'::text, 'duplicate'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."bug_tickets" drop constraint if exists "chk_bug_tickets_status";
alter table "public"."bug_tickets" drop constraint if exists "chk_bug_tickets_priority";
alter table "public"."bug_tickets" drop constraint if exists "chk_bug_tickets_origin";
alter table "public"."bug_tickets" drop constraint if exists "chk_bug_tickets_category";
alter table "public"."bug_tickets" drop constraint if exists "bug_tickets_pkey";
  `)
}
