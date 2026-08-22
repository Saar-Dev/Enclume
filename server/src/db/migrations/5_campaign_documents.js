// 5_campaign_documents.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."campaign_documents" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "name" character varying(255) not null,
    "content_html" text not null default ''::text,
    "gm_notes_html" text not null default ''::text,
    "viewer_ids" jsonb not null,
    "editor_ids" jsonb not null,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."campaign_documents" cascade;
  `)
}
