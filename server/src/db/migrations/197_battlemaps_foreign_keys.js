// 197_battlemaps_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."battlemaps" add constraint "battlemaps_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."battlemaps" add constraint "battlemaps_editor_locked_by_foreign" FOREIGN KEY (editor_locked_by) REFERENCES users(id);

alter table "public"."battlemaps" add constraint "battlemaps_folder_id_foreign" FOREIGN KEY (folder_id) REFERENCES battlemap_folders(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."battlemaps" drop constraint if exists "battlemaps_folder_id_foreign";
alter table "public"."battlemaps" drop constraint if exists "battlemaps_editor_locked_by_foreign";
alter table "public"."battlemaps" drop constraint if exists "battlemaps_campaign_id_foreign";
  `)
}
