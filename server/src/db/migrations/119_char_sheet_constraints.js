// 119_char_sheet_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_sheet_pkey ON public.char_sheet USING btree (id);

CREATE UNIQUE INDEX uq_char_sheet_character_id ON public.char_sheet USING btree (character_id);

alter table "public"."char_sheet" add constraint "char_sheet_pkey" PRIMARY KEY using index "char_sheet_pkey";

alter table "public"."char_sheet" add constraint "uq_char_sheet_character_id" UNIQUE using index "uq_char_sheet_character_id";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_sheet" drop constraint if exists "uq_char_sheet_character_id";
alter table "public"."char_sheet" drop constraint if exists "char_sheet_pkey";
  `)
}
