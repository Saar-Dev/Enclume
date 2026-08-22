// 89_vaults.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."vaults" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."vaults" cascade;
  `)
}
