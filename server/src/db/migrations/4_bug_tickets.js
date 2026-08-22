// 4_bug_tickets.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."bug_tickets" (
    "id" uuid not null default gen_random_uuid(),
    "reporter_id" uuid,
    "origin" text not null,
    "category" text not null,
    "domain" text,
    "title" text not null,
    "description" text not null,
    "context" jsonb,
    "status" text not null default 'new'::text,
    "priority" text,
    "cluster_label" text,
    "linked_bug_code" text,
    "admin_notes" text,
    "reviewed_by" uuid,
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."bug_tickets" cascade;
  `)
}
