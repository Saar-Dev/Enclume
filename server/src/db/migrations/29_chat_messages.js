// 29_chat_messages.js
export const up = async (knex) => {
  await knex.raw(`
create sequence "public"."chat_messages_id_seq";

create table "public"."chat_messages" (
    "id" bigint not null default nextval('chat_messages_id_seq'::regclass),
    "campaign_id" uuid not null,
    "channel_id" text not null default 'general'::text,
    "sender_user_id" uuid,
    "character_id" uuid,
    "recipient_user_id" uuid,
    "type" text not null,
    "payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "deleted_at" timestamp with time zone
);

alter sequence "public"."chat_messages_id_seq" owned by "public"."chat_messages"."id";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."chat_messages" cascade;
  `)
}
