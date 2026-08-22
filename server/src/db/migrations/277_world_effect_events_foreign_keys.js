// 277_world_effect_events_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."world_effect_events" add constraint "world_effect_events_battlemap_id_foreign" FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE CASCADE;

alter table "public"."world_effect_events" add constraint "world_effect_events_effect_instance_id_foreign" FOREIGN KEY (effect_instance_id) REFERENCES world_effect_instances(id) ON DELETE SET NULL;

alter table "public"."world_effect_events" add constraint "world_effect_events_token_id_foreign" FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."world_effect_events" drop constraint if exists "world_effect_events_token_id_foreign";
alter table "public"."world_effect_events" drop constraint if exists "world_effect_events_effect_instance_id_foreign";
alter table "public"."world_effect_events" drop constraint if exists "world_effect_events_battlemap_id_foreign";
  `)
}
