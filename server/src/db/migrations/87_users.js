// 87_users.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."users" (
    "id" uuid not null default gen_random_uuid(),
    "email" text not null,
    "password_hash" text not null,
    "username" text not null,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "color" character varying(7) not null default '#4A90D9'::character varying,
    "role" text not null default 'user'::text,
    "role_granted_by" uuid,
    "role_granted_at" timestamp with time zone
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."users" cascade;
  `)
}
