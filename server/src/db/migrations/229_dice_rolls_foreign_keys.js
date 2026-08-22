// 229_dice_rolls_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."dice_rolls" add constraint "dice_rolls_campaign_id_foreign" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

alter table "public"."dice_rolls" add constraint "dice_rolls_user_id_foreign" FOREIGN KEY (user_id) REFERENCES users(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."dice_rolls" drop constraint if exists "dice_rolls_user_id_foreign";
alter table "public"."dice_rolls" drop constraint if exists "dice_rolls_campaign_id_foreign";
  `)
}
