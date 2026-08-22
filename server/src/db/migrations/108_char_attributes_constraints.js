// 108_char_attributes_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_attributes_pkey ON public.char_attributes USING btree (char_sheet_id, attr_id);

alter table "public"."char_attributes" add constraint "char_attributes_pkey" PRIMARY KEY using index "char_attributes_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_attributes" drop constraint if exists "char_attributes_pkey";
  `)
}
