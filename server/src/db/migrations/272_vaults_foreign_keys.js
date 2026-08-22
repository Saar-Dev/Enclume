// 272_vaults_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."vaults" add constraint "vaults_user_id_foreign" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."vaults" drop constraint if exists "vaults_user_id_foreign";
  `)
}
