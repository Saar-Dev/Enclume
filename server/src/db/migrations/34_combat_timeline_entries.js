// 34_combat_timeline_entries.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."combat_timeline_entries" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "turn_number" integer not null,
    "token_id" uuid not null,
    "combat_action_id" uuid not null,
    "declaration_group_id" uuid,
    "phase_position" integer,
    "status" text not null default 'scheduled'::text,
    "resolved_at" timestamp with time zone,
    "resolution_snapshot" jsonb,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."combat_timeline_entries" cascade;
  `)
}
