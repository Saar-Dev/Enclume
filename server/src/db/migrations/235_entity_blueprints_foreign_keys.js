// 235_entity_blueprints_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."entity_blueprints" add constraint "entity_blueprints_created_by_foreign" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

alter table "public"."entity_blueprints" add constraint "entity_blueprints_pack_id_foreign" FOREIGN KEY (pack_id) REFERENCES texture_packs(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."entity_blueprints" drop constraint if exists "entity_blueprints_pack_id_foreign";
alter table "public"."entity_blueprints" drop constraint if exists "entity_blueprints_created_by_foreign";
  `)
}
