// 30_combat_actions.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."combat_actions" (
    "id" uuid not null default gen_random_uuid(),
    "campaign_id" uuid not null,
    "token_id" uuid not null,
    "type" text not null,
    "target_token_id" uuid,
    "weapon_inv_id" uuid,
    "modifiers" jsonb,
    "status" text not null default 'pending'::text,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "action_key" text not null,
    "sequence" smallint default '0'::smallint,
    "target_pos_x" double precision,
    "target_pos_y" double precision,
    "target_pos_z" double precision,
    "fire_mode" text,
    "bullet_count" smallint,
    "fire_mode_bonus_comp" smallint,
    "fire_mode_bonus_dmg" smallint,
    "drone_weapon_inv_id" uuid,
    "aim_bonus_comp" smallint,
    "natural_weapon_char_mutation_id" uuid,
    "movement_gait" text,
    "destination_world" jsonb,
    "world_plan" jsonb,
    "planned_world_revision" integer,
    "planned_runtime_revision" integer,
    "planned_budget_m" numeric(12,4),
    "aimed_location" text,
    "turn_number" integer not null default 1,
    "offhand_weapon_inv_id" uuid
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."combat_actions" cascade;
  `)
}
