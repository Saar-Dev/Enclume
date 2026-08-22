// 126_chat_messages_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id);

CREATE INDEX idx_chat_messages_cursor ON public.chat_messages USING btree (campaign_id, channel_id, created_at DESC, id DESC);

alter table "public"."chat_messages" add constraint "chat_messages_pkey" PRIMARY KEY using index "chat_messages_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."chat_messages" drop constraint if exists "chat_messages_pkey";
drop index if exists "idx_chat_messages_cursor";
  `)
}
