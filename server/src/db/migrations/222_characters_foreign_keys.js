// 222_characters_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."characters" add constraint "characters_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."characters" add constraint "characters_user_id_foreign" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

alter table "public"."characters" add constraint "characters_vault_id_foreign" FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."characters" drop constraint if exists "characters_vault_id_foreign";
alter table "public"."characters" drop constraint if exists "characters_user_id_foreign";
alter table "public"."characters" drop constraint if exists "characters_campaign_id_foreign";
  `)
}
