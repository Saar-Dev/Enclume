// 266_token_statuses_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."token_statuses" add constraint "token_statuses_applied_by_foreign" FOREIGN KEY (applied_by) REFERENCES users(id) ON DELETE SET NULL;

alter table "public"."token_statuses" add constraint "token_statuses_token_id_foreign" FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."token_statuses" drop constraint if exists "token_statuses_token_id_foreign";
alter table "public"."token_statuses" drop constraint if exists "token_statuses_applied_by_foreign";
  `)
}
