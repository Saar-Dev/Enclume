// 278_world_effect_instances_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."world_effect_instances" add constraint "world_effect_instances_battlemap_id_foreign" FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE CASCADE;

alter table "public"."world_effect_instances" add constraint "world_effect_instances_created_by_foreign" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."world_effect_instances" drop constraint if exists "world_effect_instances_created_by_foreign";
alter table "public"."world_effect_instances" drop constraint if exists "world_effect_instances_battlemap_id_foreign";
  `)
}
