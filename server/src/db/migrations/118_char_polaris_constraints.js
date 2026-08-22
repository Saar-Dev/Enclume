// 118_char_polaris_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_polaris_pkey ON public.char_polaris USING btree (char_sheet_id);

alter table "public"."char_polaris" add constraint "char_polaris_pkey" PRIMARY KEY using index "char_polaris_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_polaris" drop constraint if exists "char_polaris_pkey";
  `)
}
