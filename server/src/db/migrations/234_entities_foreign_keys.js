// 234_entities_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."entities" add constraint "entities_battlemap_id_foreign" FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE CASCADE;

alter table "public"."entities" add constraint "entities_blueprint_id_foreign" FOREIGN KEY (blueprint_id) REFERENCES entity_blueprints(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."entities" drop constraint if exists "entities_blueprint_id_foreign";
alter table "public"."entities" drop constraint if exists "entities_battlemap_id_foreign";
  `)
}
