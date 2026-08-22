// 227_combat_state_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."combat_state" add constraint "combat_state_battlemap_id_foreign" FOREIGN KEY (battlemap_id) REFERENCES battlemaps(id) ON DELETE SET NULL;

alter table "public"."combat_state" add constraint "combat_state_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."combat_state" drop constraint if exists "combat_state_campaign_id_foreign";
alter table "public"."combat_state" drop constraint if exists "combat_state_battlemap_id_foreign";
  `)
}
