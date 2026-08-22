// 201_campaigns_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."campaigns" add constraint "campaigns_default_battlemap_id_foreign" FOREIGN KEY (default_battlemap_id) REFERENCES battlemaps(id) ON DELETE SET NULL;

alter table "public"."campaigns" add constraint "campaigns_gm_id_foreign" FOREIGN KEY (gm_id) REFERENCES users(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."campaigns" drop constraint if exists "campaigns_gm_id_foreign";
alter table "public"."campaigns" drop constraint if exists "campaigns_default_battlemap_id_foreign";
  `)
}
