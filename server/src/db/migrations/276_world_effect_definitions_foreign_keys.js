// 276_world_effect_definitions_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."world_effect_definitions" add constraint "world_effect_definitions_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."world_effect_definitions" add constraint "world_effect_definitions_created_by_foreign" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."world_effect_definitions" drop constraint if exists "world_effect_definitions_created_by_foreign";
alter table "public"."world_effect_definitions" drop constraint if exists "world_effect_definitions_campaign_id_foreign";
  `)
}
