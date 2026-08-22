// 270_users_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."users" add constraint "users_role_granted_by_foreign" FOREIGN KEY (role_granted_by) REFERENCES users(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."users" drop constraint if exists "users_role_granted_by_foreign";
  `)
}
