// 50_pending_catastrophes.js
export const up = async (knex) => {
  await knex.raw(`
create sequence "public"."pending_catastrophes_id_seq";

create table "public"."pending_catastrophes" (
    "id" integer not null default nextval('pending_catastrophes_id_seq'::regclass),
    "campaign_id" uuid not null,
    "token_id" uuid not null,
    "table_entry" integer not null,
    "applied_entry" integer,
    "context" jsonb not null default '{}'::jsonb,
    "rolled_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "resolved_at" timestamp with time zone,
    "resolved_by" uuid
);

alter sequence "public"."pending_catastrophes_id_seq" owned by "public"."pending_catastrophes"."id";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."pending_catastrophes" cascade;
  `)
}
