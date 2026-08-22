// 195_battlemap_folders_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."battlemap_folders" add constraint "battlemap_folders_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."battlemap_folders" add constraint "battlemap_folders_parent_folder_id_foreign" FOREIGN KEY (parent_folder_id) REFERENCES battlemap_folders(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."battlemap_folders" drop constraint if exists "battlemap_folders_parent_folder_id_foreign";
alter table "public"."battlemap_folders" drop constraint if exists "battlemap_folders_campaign_id_foreign";
  `)
}
