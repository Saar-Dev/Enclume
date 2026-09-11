// 338_pending_chance_choices_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."pending_chance_choices" add constraint "pending_chance_choices_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."pending_chance_choices" add constraint "pending_chance_choices_character_id_foreign" FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;

alter table "public"."pending_chance_choices" add constraint "pending_chance_choices_resolved_by_foreign" FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."pending_chance_choices" drop constraint if exists "pending_chance_choices_resolved_by_foreign";
alter table "public"."pending_chance_choices" drop constraint if exists "pending_chance_choices_character_id_foreign";
alter table "public"."pending_chance_choices" drop constraint if exists "pending_chance_choices_campaign_id_foreign";
  `)
}
