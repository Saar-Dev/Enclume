// 242_legacy_zones_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."legacy_zones" add constraint "zones_battlemap_id_foreign" FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."legacy_zones" drop constraint if exists "zones_battlemap_id_foreign";
  `)
}
