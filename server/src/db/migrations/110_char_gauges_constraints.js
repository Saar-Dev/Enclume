// 110_char_gauges_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_gauges_pkey ON public.char_gauges USING btree (char_sheet_id, category_key);

alter table "public"."char_gauges" add constraint "char_gauges_pkey" PRIMARY KEY using index "char_gauges_pkey";

alter table "public"."char_gauges" add constraint "chk_gauges_value_non_negative" CHECK ((value >= 0));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_gauges" drop constraint if exists "chk_gauges_value_non_negative";
alter table "public"."char_gauges" drop constraint if exists "char_gauges_pkey";
  `)
}
