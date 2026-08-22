// 132_dice_rolls_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX dice_rolls_pkey ON public.dice_rolls USING btree (id);

alter table "public"."dice_rolls" add constraint "dice_rolls_pkey" PRIMARY KEY using index "dice_rolls_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."dice_rolls" drop constraint if exists "dice_rolls_pkey";
  `)
}
