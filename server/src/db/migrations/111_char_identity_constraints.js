// 111_char_identity_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_identity_pkey ON public.char_identity USING btree (char_sheet_id);

alter table "public"."char_identity" add constraint "char_identity_pkey" PRIMARY KEY using index "char_identity_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_identity" drop constraint if exists "char_identity_pkey";
  `)
}
