// 107_char_archetype_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_archetype_pkey ON public.char_archetype USING btree (char_sheet_id);

alter table "public"."char_archetype" add constraint "char_archetype_pkey" PRIMARY KEY using index "char_archetype_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_archetype" drop constraint if exists "char_archetype_pkey";
  `)
}
