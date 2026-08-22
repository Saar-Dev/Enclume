// 223_chat_messages_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."chat_messages" add constraint "chat_messages_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."chat_messages" add constraint "chat_messages_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL;

alter table "public"."chat_messages" add constraint "chat_messages_recipient_user_id_foreign" FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL;

alter table "public"."chat_messages" add constraint "chat_messages_sender_user_id_foreign" FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."chat_messages" drop constraint if exists "chat_messages_sender_user_id_foreign";
alter table "public"."chat_messages" drop constraint if exists "chat_messages_recipient_user_id_foreign";
alter table "public"."chat_messages" drop constraint if exists "chat_messages_character_id_foreign";
alter table "public"."chat_messages" drop constraint if exists "chat_messages_campaign_id_foreign";
  `)
}
