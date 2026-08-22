// 280_world_feature_states_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."world_feature_states" add constraint "world_feature_states_battlemap_id_foreign" FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE CASCADE;

alter table "public"."world_feature_states" add constraint "world_feature_states_updated_by_foreign" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."world_feature_states" drop constraint if exists "world_feature_states_updated_by_foreign";
alter table "public"."world_feature_states" drop constraint if exists "world_feature_states_battlemap_id_foreign";
  `)
}
