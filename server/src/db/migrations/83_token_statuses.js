// 83_token_statuses.js
export const up = async (knex) => {
  await knex.raw(`
create sequence "public"."token_statuses_id_seq";

create table "public"."token_statuses" (
    "id" integer not null default nextval('token_statuses_id_seq'::regclass),
    "token_id" uuid not null,
    "status_code" text not null,
    "applied_by" uuid,
    "applied_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "expires_at_turn" integer,
    "data" jsonb
);

alter sequence "public"."token_statuses_id_seq" owned by "public"."token_statuses"."id";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."token_statuses" cascade;
  `)
}
