// 28_characters.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."characters" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid,
    "user_id" uuid,
    "name" character varying(100) not null,
    "color" character varying(7) not null default '#4A90D9'::character varying,
    "visible" boolean not null default true,
    "glb_url" text,
    "portrait_url" text,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "description" text,
    "gm_notes" text,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "type" text not null default 'pnj'::text,
    "vault_id" uuid,
    "token_style" jsonb
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."characters" cascade;
  `)
}
