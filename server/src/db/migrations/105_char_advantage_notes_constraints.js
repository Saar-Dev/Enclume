// 105_char_advantage_notes_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_advantage_notes_pkey ON public.char_advantage_notes USING btree (id);

alter table "public"."char_advantage_notes" add constraint "char_advantage_notes_pkey" PRIMARY KEY using index "char_advantage_notes_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_advantage_notes" drop constraint if exists "char_advantage_notes_pkey";
  `)
}
