// 274_walls_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."walls" add constraint "walls_battlemap_id_foreign" FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."walls" drop constraint if exists "walls_battlemap_id_foreign";
  `)
}
