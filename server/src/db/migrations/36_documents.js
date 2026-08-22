// 36_documents.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."documents" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "uploaded_by" uuid not null,
    "name" text not null,
    "file_url" text not null,
    "file_type" text,
    "visibility" text default 'gm_only'::text,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."documents" cascade;
  `)
}
