// 336_pending_chance_choices.js
export const up = async (knex) => {
  await knex.raw(`
create sequence "public"."pending_chance_choices_id_seq";

create table "public"."pending_chance_choices" (
    "id" integer not null default nextval('pending_chance_choices_id_seq'::regclass),
    "campaign_id" uuid not null,
    "character_id" uuid not null,
    "site" text not null,
    "test_label" text,
    "context" jsonb not null default '{}'::jsonb,
    "choice" text,
    "rolled_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "resolved_at" timestamp with time zone,
    "resolved_by" uuid
);

alter sequence "public"."pending_chance_choices_id_seq" owned by "public"."pending_chance_choices"."id";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."pending_chance_choices" cascade;
  `)
}
