// 224_combat_actions_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."combat_actions" add constraint "combat_actions_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."combat_actions" add constraint "combat_actions_drone_weapon_inv_id_foreign" FOREIGN KEY (drone_weapon_inv_id) REFERENCES drone_weapons(id) ON DELETE SET NULL;

alter table "public"."combat_actions" add constraint "combat_actions_natural_weapon_char_mutation_id_foreign" FOREIGN KEY (natural_weapon_char_mutation_id) REFERENCES char_mutations(id) ON DELETE SET NULL;

alter table "public"."combat_actions" add constraint "combat_actions_offhand_weapon_inv_id_foreign" FOREIGN KEY (offhand_weapon_inv_id) REFERENCES char_inventory(id) ON DELETE SET NULL;

alter table "public"."combat_actions" add constraint "combat_actions_target_token_id_foreign" FOREIGN KEY (target_token_id) REFERENCES tokens(id) ON DELETE SET NULL;

alter table "public"."combat_actions" add constraint "combat_actions_token_id_foreign" FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE;

alter table "public"."combat_actions" add constraint "combat_actions_weapon_inv_id_foreign" FOREIGN KEY (weapon_inv_id) REFERENCES char_inventory(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."combat_actions" drop constraint if exists "combat_actions_weapon_inv_id_foreign";
alter table "public"."combat_actions" drop constraint if exists "combat_actions_token_id_foreign";
alter table "public"."combat_actions" drop constraint if exists "combat_actions_target_token_id_foreign";
alter table "public"."combat_actions" drop constraint if exists "combat_actions_offhand_weapon_inv_id_foreign";
alter table "public"."combat_actions" drop constraint if exists "combat_actions_natural_weapon_char_mutation_id_foreign";
alter table "public"."combat_actions" drop constraint if exists "combat_actions_drone_weapon_inv_id_foreign";
alter table "public"."combat_actions" drop constraint if exists "combat_actions_campaign_id_foreign";
  `)
}
