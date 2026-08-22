// 279_world_elevator_passengers_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."world_elevator_passengers" add constraint "world_elevator_passengers_battlemap_id_foreign" FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE CASCADE;

alter table "public"."world_elevator_passengers" add constraint "world_elevator_passengers_token_id_foreign" FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."world_elevator_passengers" drop constraint if exists "world_elevator_passengers_token_id_foreign";
alter table "public"."world_elevator_passengers" drop constraint if exists "world_elevator_passengers_battlemap_id_foreign";
  `)
}
